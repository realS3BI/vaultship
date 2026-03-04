# vaultship

`vaultship` provides two workflows:

- release automation for version bumps, changelog generation, PR creation, Docker publishing, and deployment hooks
- encrypted `.env` synchronization backed by PocketBase

## Requirements

- Node.js 20+
- `pnpm`
- Git
- GitHub repository with `origin` configured

## Install

```bash
pnpm add -D vaultship
```

## Commands

```bash
vaultship init
vaultship update
vaultship release [--minor|--major]
vaultship env push
vaultship env pull
vaultship config list
vaultship config get <key>
vaultship config set <key> <value>
```

## Configuration

Global config is stored at `~/.vaultship/config.json`.

Project config is stored at `.vaultshiprc.json`.

## Development

```bash
pnpm install
pnpm build
```

## Publishing (maintainers)

### Docker image (GHCR)

The PocketBase server image is built and pushed to [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) automatically:

- **On push to `main`**: image tagged as `ghcr.io/<owner>/vaultship/server:latest`
- **On version tag** (e.g. `1.0.0` or `v1.0.0`): image tagged with that version and as `latest`

No secrets required; the workflow uses `GITHUB_TOKEN`. Make the image public under repo **Settings → Packages → Package visibility** if needed.

Pull and run:

```bash
docker pull ghcr.io/<owner>/vaultship/server:latest
docker run -p 8090:8090 ghcr.io/<owner>/vaultship/server:latest
```

### npm package

`vaultship` is published to npm when a **version tag** is pushed. Prerequisites:

1. Create an [npm access token](https://www.npmjs.com/settings/~/tokens) (Automation or Publish).
2. Add it as a repository secret: **Settings → Secrets and variables → Actions → New repository secret** → name: `NPM_TOKEN`, value: your token.

To release a new version:

1. Bump version (e.g. `pnpm version minor` or update `package.json` and commit).
2. Push a tag that matches the new version:
   ```bash
   git tag v1.0.0   # or 1.0.0
   git push origin v1.0.0
   ```
3. The workflow will build, check that the tag matches `package.json` version, and run `pnpm publish`.

The package is published as `vaultship`, so consumers can install it directly without a scoped `/cli` suffix.
