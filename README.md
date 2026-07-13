# SEO Agent Orchestrator

An evidence-first control plane for orchestrating specialist Hermes agents across website diagnostics, market and intent research, opportunity prioritisation, SEO copy generation, and independent quality review.

## Workflow

1. Validate a public target URL.
2. Collect bounded first-party technical evidence.
3. Run isolated market and search-intent research.
4. Rank evidence-backed opportunities.
5. Produce one bounded copy candidate.
6. Require an independent QC pass before showing final copy.

The application never publishes or modifies the target website.

## Local runtime

The complete workflow requires a locally configured [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) runtime.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality gates

```bash
npm run test
npm run lint
npm run typecheck
npm run security:audit
npm run build
```

## Hosted deployment

The editorial dashboard can be deployed to Vercel as a public product preview. Live audit submission is disabled there because Vercel serverless functions cannot safely spawn the local Hermes runtime or persist its run artifacts. A future hosted version should use an authenticated, signed handoff to a durable Hermes worker.
