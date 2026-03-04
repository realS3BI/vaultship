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

## PocketBase server (env sync)

For `vaultship env push` / `env pull` you need a PocketBase instance with the vaultship migrations (e.g. the official server image or `docker-compose`).

### Run with docker-compose

From the repo root:

```bash
cp .env.example .env
# Edit .env: set PORT, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
docker compose up -d
```

**Environment variables**

| Variable | Description |
|----------|-------------|
| `PORT` | Port the server listens on (default: `8090`). Use this to choose where the server runs (e.g. `9090`). |
| `PB_ADMIN_EMAIL` | Admin email. If set together with `PB_ADMIN_PASSWORD`, the server creates/updates this admin on every startup. |
| `PB_ADMIN_PASSWORD` | Admin password (only used when `PB_ADMIN_EMAIL` is also set). |
| `PB_URL` | Optional. Base URL where you access PocketBase (for your own reference). vaultship uses `apiUrl` from `vaultship config`. |

**URL and API key**

- **apiUrl**: Set where your PocketBase is reachable, e.g. `http://localhost:8090` or `https://pb.yourdomain.com`. Configure with `vaultship config set apiUrl <url>`.
- **apiKey**: After the first start, open the Admin UI (e.g. `http://localhost:8090`), log in with `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`, create an API token, then run `vaultship config set apiKey <token>`.

The server runs migrations automatically on startup and needs no manual DB setup.

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

`vaultship` is published to npm when a **version tag** is pushed, using [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC). No long-lived tokens are required.

**One-time setup:** On [npm](https://www.npmjs.com/package/vaultship/access), add a Trusted Publisher with this repo and workflow filename `npm-publish.yml` (the workflow lives at `.github/workflows/npm-publish.yml`). Once configured, pushes of version tags trigger the workflow and npm accepts the publish via OIDC.

To release a new version:

1. Bump version (e.g. `pnpm version minor` or update `package.json` and commit).
2. Push a tag that matches the new version:

   ```bash
   git tag v1.0.0   # or 1.0.0
   git push origin v1.0.0
   ```

3. The workflow will build, verify the tag matches `package.json` version, and run `pnpm publish`.

The package is published as `vaultship`, so consumers can install it directly without a scoped `/cli` suffix.
