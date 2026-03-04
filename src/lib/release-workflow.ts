import fs from "node:fs";
import path from "node:path";
import { ReleaseTargets } from "./project-config";

function sanitizeDockerContext(contextPath: string): string {
  const trimmed = contextPath.trim();

  if (!trimmed || trimmed === ".") {
    return ".";
  }

  return trimmed.replace(/^\.?\//, "").replace(/\\/g, "/");
}

function dockerfilePathFromContext(contextPath: string): string {
  const normalized = sanitizeDockerContext(contextPath);
  return normalized === "." ? "Dockerfile" : `${normalized}/Dockerfile`;
}

function getDockerSteps(releaseTargets: ReleaseTargets): string {
  const dockerContext = sanitizeDockerContext(releaseTargets.dockerContext);
  const dockerfilePath = dockerfilePathFromContext(dockerContext);
  const dockerImage = releaseTargets.dockerImage || "${{ env.REGISTRY }}/${{ github.repository }}";

  return `
      - name: Validate Dockerfile
        run: |
          if [ ! -f "${dockerfilePath}" ]; then
            echo "Docker deploy is enabled, but no Dockerfile was found at ${dockerfilePath}."
            exit 1
          fi

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${dockerImage}
          tags: |
            type=semver,pattern={{version}},value=\${{ steps.version.outputs.version }}
            type=raw,value=latest

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: ${dockerContext}
          file: ${dockerfilePath}
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;
}

function getNpmTrustedPublisherSteps(): string {
  return `
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
          cache: pnpm

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Publish package to npm
        run: |
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          TAG_VERSION="\${{ steps.version.outputs.version }}"

          if [ "v$PACKAGE_VERSION" != "$TAG_VERSION" ]; then
            echo "Tag $TAG_VERSION does not match package.json version v$PACKAGE_VERSION."
            exit 1
          fi

          pnpm publish --no-git-checks --provenance
`;
}

function getConvexSteps(): string {
  return `
      - name: Deploy to Convex
        env:
          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            echo "Missing repository secret CONVEX_DEPLOY_KEY."
            exit 1
          fi

          npx convex deploy
`;
}

function getWebhookSteps(): string {
  return `
      - name: Trigger Deployment Webhook
        env:
          DEPLOY_WEBHOOK_URL: \${{ vars.DEPLOY_WEBHOOK_URL }}
          DEPLOY_WEBHOOK_SECRET: \${{ secrets.DEPLOY_WEBHOOK_SECRET }}
        run: |
          if [ -z "$DEPLOY_WEBHOOK_URL" ]; then
            echo "Missing repository variable DEPLOY_WEBHOOK_URL."
            exit 1
          fi

          curl -X POST "$DEPLOY_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $DEPLOY_WEBHOOK_SECRET" \
            -d '{"version":"\${{ steps.version.outputs.version }}","repository":"\${{ github.repository }}"}' \
            --fail --silent --show-error
`;
}

export function renderReleaseWorkflow(releaseTargets: ReleaseTargets): string {
  const idTokenPermission = releaseTargets.npmTrustedPublisher ? "  id-token: write\n" : "";
  const dockerSteps = releaseTargets.docker ? getDockerSteps(releaseTargets) : "";
  const npmSteps = releaseTargets.npmTrustedPublisher ? getNpmTrustedPublisherSteps() : "";
  const convexSteps = releaseTargets.convex ? getConvexSteps() : "";
  const webhookSteps = releaseTargets.webhook ? getWebhookSteps() : "";

  return `name: Release

on:
  pull_request:
    types: [closed]
    branches: [main]

permissions:
  contents: write
  packages: write
${idTokenPermission}
env:
  REGISTRY: ghcr.io

jobs:
  release:
    if: |
      github.event.pull_request.merged == true &&
      startsWith(github.event.pull_request.head.ref, 'release/')
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Extract version
        id: version
        run: |
          BRANCH="\${{ github.event.pull_request.head.ref }}"
          VERSION="\${BRANCH#release/}"

          if ! echo "$VERSION" | grep -Eq '^v[0-9]+\\.[0-9]+\\.[0-9]+$'; then
            echo "Release branch must be named release/vX.Y.Z. Got: $BRANCH"
            exit 1
          fi

          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Release version: $VERSION"

      - name: Create Git Tag
        env:
          TAG: \${{ steps.version.outputs.version }}
          RELEASE_TOKEN: \${{ secrets.VAULTSHIP_RELEASE_TOKEN }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
            echo "Tag $TAG already exists. Skipping tag creation."
          else
            git tag -a "$TAG" -m "Release $TAG"
            if [ -n "$RELEASE_TOKEN" ]; then
              git push "https://x-access-token:\${RELEASE_TOKEN}@github.com/\${{ github.repository }}.git" "$TAG"
            else
              echo "::warning::VAULTSHIP_RELEASE_TOKEN is not set. Pushing with GITHUB_TOKEN; downstream tag workflows may not run."
              git push origin "$TAG"
            fi
          fi

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ steps.version.outputs.version }}
          name: Release \${{ steps.version.outputs.version }}
          body: \${{ github.event.pull_request.body }}
          generate_release_notes: false
${dockerSteps}${npmSteps}${convexSteps}${webhookSteps}
      - name: Cleanup release branch
        run: |
          git push origin --delete "\${{ github.event.pull_request.head.ref }}" || true
`;
}

export function writeReleaseWorkflow(releaseTargets: ReleaseTargets, cwd = process.cwd()): void {
  const workflowPath = path.join(cwd, ".github", "workflows", "release.yml");
  fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
  fs.writeFileSync(workflowPath, renderReleaseWorkflow(releaseTargets), "utf8");
}
