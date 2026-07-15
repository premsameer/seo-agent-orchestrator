# Deploying Kairo live (stateful host)

The live worker shells out to the `hermes` CLI binary, which is not an npm
dependency. The app runs LIVE automatically whenever `process.env.VERCEL` is
unset and `KAIRO_LIVE` is not `0`. On Vercel it stays in preview (no persistent
process/filesystem).

## What the host must provide
1. Node 22 (the Dockerfile pins node:22-bookworm-slim).
2. The `hermes` binary on PATH and an authenticated `~/.hermes` (auth.json).
3. A persistent disk for `/app/runs` (worker writes run artifacts there).
4. Outbound internet (evidence collection + Hermes API calls).

## Environment
- `KAIRO_LIVE=1`            — live on a stateful host (default when no VERCEL).
- `KAIRO_LIVE=0`            — force preview (sample result only).
- `KAIRO_API_KEY=...`       — optional; when set, POST /api/audits requires
                              header `x-kairo-key: <value>`.
- `HERMES_SEO_MAX_RUNTIME_MS` — optional worker timeout (default 1,800,000).

## Render / Fly / VM (Docker)
1. Push this repo to GitHub.
2. Create a new web service from the Dockerfile.
3. Set `KAIRO_LIVE=1` and (recommended) `KAIRO_API_KEY=<strong secret>`.
4. Provide Hermes: either bake an install step into the Dockerfile, or mount
   the host `~/.hermes` and a `hermes` binary as a volume/env.
5. Mount a persistent volume at `/app/runs`.

## Verify
- Homepage loads the live form (not "Sample only").
- `curl -X POST https://<host>/api/audits -H 'content-type: application/json' \
   -H 'x-kairo-key: <key>' -d '{"url":"https://example.com",
   "objective":"Generate more qualified leads"}'` → 202.
- Without the key (when set) → 401.

## If you only want the preview
Leave `KAIRO_LIVE=0`. The site serves the full sample operation; no Hermes
binary or key required.
