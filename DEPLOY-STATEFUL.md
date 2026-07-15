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

## Permanent deploy — Render (recommended for MVP)
`render.yaml` in this repo configures a Docker web service with a persistent
disk at `/app/runs`. To go live permanently:
1. Push this repo to GitHub.
2. New → Web Service → connect the repo → Render auto-detects `render.yaml`.
3. In Render dashboard, set `KAIRO_API_KEY` to a strong random string
   (secret; not in git).
4. Provide Hermes. Easiest MVP path: add a start command that installs the
   Hermes CLI then boots the app. Create `start.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # Install Hermes CLI if missing (adjust to your install method).
   if ! command -v hermes >/dev/null 2>&1; then
     npm install -g hermes-cli   # or your org's install command
   fi
   # Mount authenticated ~/.hermes from a Render secret file (dashboard:
   # Secret Files → ~/.hermes). Ensure it is present before starting.
   exec npm run start
   ```
   Point the Render service's start command at `bash start.sh`.
5. Optionally map a custom domain in the Render dashboard.

Once built, you get a permanent `https://hermes-growth-operator.onrender.com`
(or your domain) — no tunnel, no session dependency.

## Temporary demo — Cloudflare quick tunnel (session-bound)
For a fast local demo without a host:
```bash
npm run start                       # serves :3000 (KAIRO_LIVE defaults to 1)
cloudflared tunnel --url http://localhost:3000
```
The `*.trycloudflare.com` URL dies when this machine/session ends. Not for
production.

## Verify
- Homepage loads the live form (not "Sample only").
- `curl -X POST https://<host>/api/audits -H 'content-type: application/json' \
   -H 'x-kairo-key: <key>' -d '{"url":"https://example.com",
   "objective":"Generate more qualified leads"}'` → 202.
- Without the key (when set) → 401.
- Poll `GET /api/runs/<runId>` until `status: complete`.

## If you only want the preview
Leave `KAIRO_LIVE=0`. The site serves the full sample operation; no Hermes
binary or key required.
