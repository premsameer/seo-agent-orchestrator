# Hermes SEO Operator Vertical Slice Implementation Plan

> **For Hermes:** Execute this plan with strict test-first vertical slices and verify every external claim with captured evidence.

**Goal:** Build a reliable Hermes-native demo in which a founder supplies one public website and commercial objective, Hermes gathers evidence, delegates market analysis, prioritises one commercial-page opportunity, drafts an improvement, rejects or revises weak work, requests approval before publishing, stores reusable operating context, and schedules a follow-up.

**Architecture:** Hermes remains the orchestrator and user interface through Telegram/CLI. A small deterministic TypeScript evidence layer validates intake and turns website observations into a structured, auditable report; Hermes web/browser tools perform live research, `delegate_task` provides an isolated market specialist, a reusable skill defines orchestration and QC, and cron performs future monitoring. The Next.js surface is limited to a local evidence/report viewer only if time remains; it is not the product.

**Tech Stack:** Hermes Agent, TypeScript, Vitest, Node.js fetch, Next.js 16 only for the existing optional presentation surface, Telegram gateway, Hermes memory/skills/delegation/cron.

---

## Scope decisions

Build only one closed loop: improve one existing commercial/service page. Do not build autonomous publishing, backlink outreach, rank tracking, a general crawler, authentication, billing, CRM integration, or a SaaS dashboard.

## Acceptance criteria

1. A URL, commercial objective, and page type are validated; localhost/private/credential-bearing targets are rejected.
2. Live public evidence is collected from the target page, robots.txt, and sitemap where available, with source URLs and timestamps.
3. One market-research subagent returns competitor/search-intent evidence.
4. Hermes ranks opportunities and selects exactly one executable commercial-page improvement.
5. The deliverable includes title, meta description, H1, page outline, internal-link recommendations, evidence citations, assumptions, and unsupported-claim warnings.
6. An independent QC pass can reject the first draft against explicit rules and demand one revision.
7. No publishing or external modification occurs without explicit user approval.
8. Stable business context and the successful operating procedure can be persisted; temporary run output is stored in project artifacts, not global memory.
9. A paused or user-approved recurring cron monitor can be created with the project workdir and Telegram delivery.
10. Tests, lint, typecheck, build, and one live end-to-end run succeed.

## Task 1: Finish secure intake validation

**Files:**
- Create: `src/lib/brief.ts`
- Test: `src/lib/brief.test.ts`

Use the existing failing tests as RED. Implement the minimum discriminated result type, URL safety checks, objective scoring, missing-context guidance, and deterministic first-action recommendation. Run `npm test -- --run src/lib/brief.test.ts`, then the full suite.

## Task 2: Add evidence and prioritisation contracts

**Files:**
- Create: `src/lib/seo/contracts.ts`
- Create: `src/lib/seo/prioritise.ts`
- Test: `src/lib/seo/prioritise.test.ts`

Write one failing test proving that an indexable commercial page with weak title/H1 alignment and no clear conversion intent outranks low-value cosmetic findings. Implement a transparent impact × confidence ÷ effort score with reasons and evidence references.

## Task 3: Add deterministic public-page evidence collection

**Files:**
- Create: `src/lib/seo/evidence.ts`
- Test: `src/lib/seo/evidence.test.ts`
- Create: `scripts/collect-seo-evidence.ts`

Test HTML extraction with fixtures before implementation. Collect status, final URL, title, meta description, canonical, robots directive, H1/H2 text, internal/external links, JSON-LD presence, word count, robots.txt, and sitemap discovery. Enforce public HTTP(S) targets and bounded response sizes/timeouts. Emit JSON containing source URLs, retrieval times, and errors instead of hiding failures.

## Task 4: Define the Hermes-native operating skill

**Artifacts:**
- Create a reusable `seo-operations-manager` Hermes skill after the deterministic core is green.
- Mirror the skill source under `hermes/seo-operations-manager/SKILL.md` for version control.

The skill must define: intake, live evidence collection, one delegated market specialist, prioritisation, one deliverable, independent QC rubric, exactly one revision, approval gate, run-artifact storage, stable memory rules, and optional scheduled follow-up. It must forbid unsupported claims, fabricated metrics, autonomous publishing, outreach, and destructive changes.

## Task 5: Add auditable run artifacts

**Files:**
- Create: `runs/.gitkeep`
- Create: `docs/demo-runbook.md`
- Update: `.gitignore`

Each run gets a timestamped directory containing `intake.json`, `site-evidence.json`, `market-evidence.md`, `backlog.json`, `draft.md`, `qc.md`, `final.md`, and `run-summary.md`. The runbook specifies which Hermes tool produced each artifact and how to show the rejection/revision moment.

## Task 6: Configure the interaction and follow-up path

- Start and verify the existing Telegram gateway.
- Do not send or publish any SEO change automatically.
- Only after the user supplies the target site and cadence, create the recurring cron job with `skills=["seo-operations-manager"]`, `workdir=/home/premsameer/hermes-growth-operator`, web/browser/delegation/file/terminal tools, and Telegram delivery.
- Keep the first scheduled job paused until the live demo run is approved.

## Task 7: Verify one real-business run

Use the user-supplied real website and commercial objective. Capture real sources, run one specialist delegation, produce and QC one commercial-page improvement, revise if rejected, and stop at approval. Run:

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- the evidence collector against the approved public URL
- `hermes gateway status`
- `hermes cron list --all`

## Risks and mitigations

- Search/browser latency: cache evidence artifacts but label timestamps and preserve a live minimal path.
- Anti-bot or missing sitemap: report the failure and continue with accessible pages; never invent evidence.
- Weak first draft: deterministic QC thresholds plus one bounded revision.
- Unsafe web targets: reject private networks, credentials, non-HTTP protocols, redirects to private networks, oversized responses, and timeouts.
- Demo overrun: improve one page only and cap delegation/QC loops.
- Gateway unavailable under WSL: start it in the supported service/foreground mode and verify delivery before the event.

## Open input required for final verification

- Real business website URL
- Commercial objective and target conversion
- Preferred commercial/service page if known
- Follow-up cadence and approval to create the scheduled monitor
