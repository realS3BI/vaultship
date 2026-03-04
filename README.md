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
- Docker build/push in that workflow is **opt-in** via repository variable `VAULTSHIP_DOCKER_RELEASE=true`.
- If `VAULTSHIP_DOCKER_RELEASE` is not enabled (or no root `Dockerfile` exists), Docker steps are skipped.
- Non-Docker repositories can use the release workflow without modification.

### npm package

`vaultship` is published to npm when a **version tag** (`vX.Y.Z`) is pushed, using [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC). No long-lived tokens are required.

**One-time setup:** On [npm](https://www.npmjs.com/package/vaultship/access), add a Trusted Publisher with this repo and workflow filename `npm-publish.yml` (the workflow lives at `.github/workflows/npm-publish.yml`). Once configured, pushes of version tags trigger the workflow and npm accepts the publish via OIDC.

To release a new version:

1. Bump version (e.g. `pnpm version minor` or update `package.json` and commit).
2. Push a tag that matches the new version:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. The workflow will build, verify the tag matches `package.json` version, and run `pnpm publish`.
   If a tag-triggered run was missed, start `.github/workflows/npm-publish.yml` via **Actions -> npm Publish -> Run workflow** and pass `tag=vX.Y.Z`.

The package is published as `vaultship`, so consumers can install it directly without a scoped `/cli` suffix.
