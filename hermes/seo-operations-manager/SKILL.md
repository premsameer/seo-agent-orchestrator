---
name: seo-operations-manager
description: "Run an evidence-backed Hermes SEO operations loop for one real public commercial page: research, audit, delegate, prioritise, draft, independently QC, revise, request approval, persist stable context, and schedule monitoring."
version: 0.1.0
created_by: agent
metadata:
  hermes:
    tags: [seo, growth, audit, delegation, evidence, telegram, cron]
---

# SEO Operations Manager

Use this skill when a founder or marketing lead supplies a real public website and a commercial growth objective. The product is the Hermes workflow, not a dashboard.

## Non-negotiable scope

Improve exactly one existing commercial, service, or homepage target per run. Produce one approval-ready deliverable. Do not autonomously publish, edit a CMS, contact prospects, buy links, change DNS, deploy code, or state unsupported performance claims.

## Required intake

Collect:

- Public target URL
- Business objective and measurable conversion
- Target audience and geography
- Preferred page, or permission to choose one
- Known constraints or claims that require proof

Reject non-HTTP(S), credential-bearing, localhost, and private-network targets. If the objective is vague, ask only for the missing conversion/audience context.

## Agent team and orchestration

Use the minimum real agent team required for the closed loop:

1. **SEO Operations Manager (parent orchestrator):** owns the plan, shared run state, assignments, evidence graph, backlog decision, approval boundary, learning, and follow-up schedule.
2. **Site & Technical Auditor (delegated):** inspects bounded static/rendered pages, robots, sitemap, metadata, indexability, internal links, technical gaps, and conversion paths.
3. **Market & Search-Intent Researcher (delegated):** researches the business, buyers, competitors, search intent, buyer questions, and cited market patterns.
4. **SEO Strategist & Asset Builder (delegated after evidence):** combines the two evidence packets into keyword themes, topic clusters, scored opportunities, and one selected SEO deliverable.
5. **Evidence & QC Reviewer (fresh delegated context):** validates every material claim and link, rejects weak work, and checks the single bounded revision.

The orchestrator may run the Site Auditor and Market Researcher in parallel. The Strategist waits for both evidence packets. The QC Reviewer must not receive the producer's hidden rationale and must run after the first draft. Deterministic URL validation, formatting, persistence, and approval state changes are tools/stages, not extra agents.

Each delegated agent must return a structured summary with sources, retrieval times, uncertainties, completion status, and no external side effects. The dashboard may show only genuine assignment/tool/event state from run artifacts; never simulate an agent as complete before its delegated task returns.

## Run artifacts

Create `runs/<UTC timestamp>-<hostname>/` in the active project and preserve:

1. `intake.json`
2. `site-evidence.json`
3. `market-evidence.md`
4. `backlog.json`
5. `draft.md`
6. `qc.md`
7. `final.md`
8. `run-summary.md`

Every factual observation must include a URL and retrieval date. Label inference as inference and missing data as unknown. Never fabricate search volume, rankings, traffic, conversions, competitor metrics, or tool results.

## Closed-loop workflow

### 1. Validate and frame

Restate the target conversion and success criterion. Run the project intake validation when available. Stop if the target is unsafe.

### 2. Collect deterministic site evidence

From `/home/premsameer/hermes-growth-operator`, run:

```bash
npm run seo:collect -- <target-url>
```

Save the JSON as `site-evidence.json`. Also use `web_extract` or browser tools on the target page when rendered content or interaction materially affects the diagnosis. Inspect robots.txt and sitemap directly when accessible. Record failures instead of concealing them.

### 3. Delegate bounded evidence specialists

Use `delegate_task` with self-contained Site Auditor and Market Researcher briefs. They must:

- inspect only the surfaces allowed by their role;
- return source URLs, observed evidence, retrieval times, uncertainties, and no invented metrics;
- avoid editing project files or taking external actions;
- clearly report partial completion and inaccessible sources.

Save the returned summaries to `site-agent-evidence.md` and `market-evidence.md`. Treat them as self-reports: verify critical URLs before relying on them.

### 4. Build and rank a bounded backlog

Create 3–7 opportunities across technical, content, and conversion categories. For each include:

- `id`, `title`, and category;
- impact (1–5), confidence (1–5), effort (1–5);
- whether Hermes can execute it within the run;
- evidence IDs and rationale.

Use score `impact × confidence ÷ effort`, but rank executable actions before non-executable programmes. Select exactly one action. Prefer an existing commercial-page improvement with direct conversion relevance.

### 5. Produce one deliverable

For a commercial-page improvement, `draft.md` must contain:

- current evidence and diagnosed intent gap;
- proposed title (normally ≤60 characters, not forced if clarity suffers);
- proposed meta description (normally ≤160 characters, not forced if clarity suffers);
- one H1;
- page promise and primary CTA;
- section outline with buyer questions and evidence needs;
- 3–5 internal-link recommendations using only verified site URLs;
- claims requiring client proof;
- implementation notes and rollback boundary;
- source list with retrieval dates.

Do not invent testimonials, accreditations, outcomes, prices, guarantees, rankings, or statistics.

### 6. Run independent QC

Perform a fresh evaluator pass separate from drafting. QC fails if any of these are true:

- unsupported factual or commercial claim;
- cited URL does not support the stated observation;
- deliverable does not address the supplied conversion;
- keyword stuffing, duplicated title/H1 without purpose, or generic filler;
- internal links were not observed on the public site or sitemap;
- risky action is presented as completed without approval;
- no clear implementation boundary or success measure;
- missing assumptions/unknowns.

Write `qc.md` with PASS or REJECT, rule-level findings, and required changes. If rejected, revise once only and rerun the failed rules. Preserve both the first draft and QC record; place the approved revision in `final.md`. If it still fails, stop and escalate rather than hiding failure.

### 7. Request approval

Before CMS edits, code changes to the target business, deployment, outreach, or other external side effects, show:

- exact proposed change;
- evidence and expected mechanism;
- uncertainty and rollback plan;
- explicit choices: approve, revise, or reject.

Absence of a reply is not approval. A demo may end at this gate.

### 8. Persist learning correctly

Use global memory only for stable business facts the user confirms (audience, approved service positioning, compliance constraints, preferred evidence standard). Do not store temporary audit findings, rankings, run IDs, or progress in memory.

Only update this skill when a procedure proved reusable or a pitfall was discovered. Keep run-specific material in `runs/`.

### 9. Schedule follow-up only with permission

After the user chooses a cadence, create a Hermes cron job with:

- this skill attached;
- a self-contained prompt naming the URL, objective, approved scope, and evidence rules;
- `workdir=/home/premsameer/hermes-growth-operator`;
- only the web, browser, terminal, file, delegation, and memory toolsets needed;
- Telegram delivery to the configured destination;
- `attach_to_session=true` when follow-up conversation is expected.

Do not create a recurring job before the target, cadence, delivery destination, and cost boundary are confirmed. Cron runs cannot recursively create cron jobs.

## Demo sequence

1. Founder sends URL + objective in Telegram.
2. Show validated intake and live site evidence.
3. Show the isolated specialist delegation and cited market evidence.
4. Show the ranked backlog and why one action wins.
5. Reveal the first draft.
6. Show QC rejecting one real defect, then the bounded revision.
7. Show the final deliverable and approval gate.
8. Show stable context/skill and the approved scheduled monitor.

## Completion criteria

A run is complete only when artifacts exist, critical evidence has been verified, exactly one action has a QC result, no external change occurred without approval, and failures/unknowns are visible in `run-summary.md`.
