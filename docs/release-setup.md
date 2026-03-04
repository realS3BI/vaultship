# Release Setup

## vaultship_release_token

1. Open GitHub repository `Settings -> Secrets and variables -> Actions`.
2. Create a new **Repository secret** named `VAULTSHIP_RELEASE_TOKEN`.
3. Value: GitHub PAT with repository write access.

## docker_ghcr

1. Ensure your Docker context path from `.vaultshiprc.json` exists (for example `server`).
2. Ensure a `Dockerfile` exists inside that context path (`server/Dockerfile` for context `server`).
3. Open GitHub repository `Settings -> Actions -> General`.
4. Set **Workflow permissions** to **Read and write permissions**.

## npm_trusted_publisher

1. Open your npm package settings: `Access -> Trusted publishers`.
2. Add this GitHub repository as trusted publisher.
3. Workflow path must be `.github/workflows/release.yml`.

## convex

1. Open GitHub repository `Settings -> Secrets and variables -> Actions`.
2. Create a new **Repository secret** named `CONVEX_DEPLOY_KEY`.
3. Value: your Convex deploy key.

## webhook

1. Open GitHub repository `Settings -> Secrets and variables -> Actions`.
2. Create a new **Repository variable** named `DEPLOY_WEBHOOK_URL`.
3. Optional: create a **Repository secret** named `DEPLOY_WEBHOOK_SECRET`.
