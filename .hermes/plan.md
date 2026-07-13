# Hermes Growth Operator — dashboard implementation plan

## Product

A user-facing SEO operations dashboard backed by Hermes. A user submits a website URL and commercial objective, then watches the system understand the business, collect website and market evidence, propose keyword themes and content clusters, prioritise changes, generate revised copy, independently review it, and request approval.

The dashboard is the multi-agent control and evidence surface. Hermes remains the runtime: one SEO Operations Manager orchestrates task-specific agents, tools, memory, approval gates, and schedules. The UI must expose genuine agent state and tool evidence rather than simulate agents with decorative progress cards.

## Agent team

1. **SEO Operations Manager (orchestrator):** validates the goal, builds the plan, owns shared run state, assigns tasks, prioritises the backlog, enforces approval, persists learning, and schedules the next cycle.
2. **Site & Technical Auditor:** crawls the bounded site surface, inspects rendered/static pages, robots, sitemap, metadata, indexability, internal links, and technical/conversion gaps.
3. **Market & Search-Intent Researcher:** researches the company, customers, services, competitors, buyer questions, search intent, and cited market patterns.
4. **SEO Strategist & Asset Builder:** combines first-party and market evidence into keyword seeds, topic clusters, opportunity scoring, and one selected SEO deliverable.
5. **Evidence & QC Reviewer:** receives evidence and the draft in a fresh context, rejects unsupported work, and verifies the single bounded revision.

The orchestrator may run the Site Auditor and Market Researcher in parallel. Strategy waits for both. QC always runs after production in a fresh isolated context. Do not create separate agents for deterministic validation, formatting, or approval-state transitions.

## Phase 1 vertical slice

1. User submits a public website URL, measurable conversion objective, audience, and geography.
2. Next.js validates the request independently and creates an audit run.
3. The server performs a bounded, SSRF-safe live website inspection.
4. A signed internal webhook hands the validated run to Hermes.
5. The orchestrator delegates the bounded site, market, strategy/asset, and independent QC tasks to the defined specialist agents and preserves cited evidence and handoffs.
6. The dashboard displays the agent plan, assignment graph, live status, tool calls, evidence handoffs, keyword seeds, clusters, opportunity scoring, generated asset, rejection/revision, and approval state.
7. Hermes produces one evidence-backed page-copy recommendation, rejects/revises it once, and stops at copy approval.
8. The dashboard shows the before/after proposal, source evidence, assumptions, expected mechanism, confidence, and measurement plan.

## Phase 2

- Connect supported CMS adapters.
- Fetch and snapshot the current CMS page/version.
- Apply approved changes in staging or as a CMS draft.
- Run rendered/static QA and show a diff.
- Require a separate production-publish approval.
- Preserve rollback data and schedule implementation/impact checks.

No autonomous publishing is part of Phase 1.

## Trust boundaries

- Treat URL, objectives, webhook payloads, and CMS content as untrusted.
- Accept only public HTTP/HTTPS targets; reject credentials, localhost, private networks, unsafe redirects, oversized responses, and timeouts.
- Do not expose a public endpoint that launches arbitrary Hermes prompts, shell commands, or agent tools.
- Dashboard-to-Hermes requests require authentication, HMAC signing, rate limits, idempotency, and an allow-listed prompt template.
- Run artifacts contain client context and remain private by default.
- Never present estimated traffic, rankings, or revenue as guaranteed outcomes.
- Copy approval, staging implementation, and production publishing are separate state transitions.

## Product language

Recommendations should state an evidence-backed impact hypothesis, confidence, effort, and measurement plan. The product must not promise that a change will increase views without Search Console/analytics evidence and a measured post-change comparison.

## Persistence boundary

- MVP: local/private structured run artifacts with stable IDs and explicit statuses.
- Production: shared database/object storage, authenticated user ownership, encrypted integration credentials, audit log, and resumable jobs.
- Hermes memory stores only confirmed stable business context; temporary findings remain attached to the run.

## Quality gates

- Unit tests for intake, URL safety, evidence extraction, prioritisation, and state transitions.
- Route tests for authentication, rate limiting, request limits, safe errors, and no-store responses.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run security:audit`, `npm run build`.
- Production-build browser verification across desktop/mobile, including invalid input and observable stage transitions.
