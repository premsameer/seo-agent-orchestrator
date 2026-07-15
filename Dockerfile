# Kairo SEO Operator — stateful host image.
# Live mode requires the `hermes` CLI binary on PATH plus its authenticated
# ~/.hermes config. This image does NOT bundle Hermes credentials; mount them
# at runtime (see deploy notes). It runs the Next.js server with a persistent
# local disk for runs/<runId>/.

FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
# Runs LIVE by default on a stateful host (no VERCEL env present).
ENV KAIRO_LIVE=1

WORKDIR /app

# Install dependencies first for layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Build the app.
COPY . .
RUN npm run build

# Hermes worker needs outbound network + a working DNS resolver.
# The app spawns `hermes chat` as a subprocess; ensure it is available.
# Option A: bake a Hermes install step here (needs network at build time).
# Option B (recommended for MVP): mount the host's ~/.hermes and a hermes
# binary into the container at runtime via a volume.
# Expects hermes on PATH; if installed elsewhere, add it to PATH below.
# ENV PATH="/opt/hermes/bin:${PATH}"

EXPOSE 3000

# Persistent run artifacts. Mount a volume here on the host.
VOLUME ["/app/runs"]

CMD ["npm", "run", "start"]
