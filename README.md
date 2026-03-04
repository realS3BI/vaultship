# vaultship

`vaultship` provides two workflows:

- release automation for version bumps, changelog generation, PR creation, Docker publishing, and deployment hooks
- encrypted `.env` synchronization backed by a lightweight SQLite server

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

## Vaultship server (env sync)

For `vaultship env push` / `env pull` you need a Vaultship server instance (e.g. the official server image or `docker-compose`).

### Run with docker-compose

From the repo root:

```bash
cp .env.example .env
# Edit .env: set PORT and VAULTSHIP_API_KEY
docker compose up -d
```

**Environment variables**

| Variable | Description |
|----------|-------------|
| `PORT` | Port the server listens on (default: `8090`). Use this to choose where the server runs (e.g. `9090`). |
| `VAULTSHIP_API_KEY` | API key used for request authentication. Recommended to set explicitly in `.env`. |
| `DB_PATH` | Optional. SQLite DB path inside the container (default: `/data/vaultship.db`). |
| `PRINT_API_KEY` | Optional (`true`/`false`). If `true`, prints the active API key at startup. |

**URL and API key**

- **apiUrl**: Set where your Vaultship server is reachable, e.g. `http://localhost:8090` or `https://vaultship.yourdomain.com`. Configure with `vaultship config set apiUrl <url>`.
- **apiKey**: Set the same key as `VAULTSHIP_API_KEY` via `vaultship config set apiKey <key>`. If `VAULTSHIP_API_KEY` is not set, the container auto-generates one and stores it in `/data/api-key`.

The server creates the SQLite table automatically on startup and needs no manual DB setup.

### Migration from PocketBase

1. Start the new Vaultship server (`docker compose up -d`) and set `VAULTSHIP_API_KEY`.
2. For each project, pull once from the old PocketBase backend (`vaultship env pull` with old `apiUrl`/`apiKey`).
3. Switch config to the new server:
   - `vaultship config set apiUrl <new-server-url>`
   - `vaultship config set apiKey <VAULTSHIP_API_KEY>`
4. Push to the new backend: `vaultship env push`

## Development

```bash
pnpm install
pnpm build
```

## Publishing (maintainers)

### Docker image (GHCR)

The Vaultship server image is built and pushed to [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) automatically:

- **On version tag** (e.g. `v1.0.0`): image tagged with that version, `<major>.<minor>`, and `latest`

No secrets required; the workflow uses `GITHUB_TOKEN`. Make the image public under repo **Settings → Packages → Package visibility** if needed.

Pull and run:

```bash
docker pull ghcr.io/<owner>/vaultship/server:latest
docker run -p 8090:8090 ghcr.io/<owner>/vaultship/server:latest
```

### Release workflow behavior

`vaultship init` installs `.github/workflows/release.yml` for application repositories.

- The release branch must be named `release/vX.Y.Z` and produces tag `vX.Y.Z`.
- To trigger downstream workflows on tag push (e.g. npm publish), set repository secret `VAULTSHIP_RELEASE_TOKEN` (PAT with repo write access). Without it, the workflow falls back to `GITHUB_TOKEN` and tag-triggered workflows may be skipped.
- GitHub release creation is always enabled.
- Optional deploy targets are configured interactively during `vaultship init` and stored in `.vaultshiprc.json`:
  - Docker publish to GHCR
  - npm publish via Trusted Publisher (OIDC)
  - Convex deploy
  - Webhook trigger
- Re-running `vaultship init` reopens those settings with existing values as defaults and regenerates the workflow.

### npm package

When npm publishing is enabled in `vaultship init`, the release workflow publishes via [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC), with no npm token required.

One-time setup on npm package access settings:

1. Add a Trusted Publisher for this GitHub repository.
2. Use workflow filename `release.yml` (path: `.github/workflows/release.yml`).

On each merged release PR (`release/vX.Y.Z`), vaultship checks that the tag and `package.json` version match and runs `pnpm publish --provenance`.
