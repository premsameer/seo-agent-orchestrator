# SEO Operator demo runbook

## Demo target

One real public commercial/service page and one measurable conversion objective. Do not use a fictional business and do not publish during the demo.

## Five-minute flow

1. Send the target URL, audience, geography, and conversion objective to Hermes in Telegram.
2. Show intake validation and `site-evidence.json`, including live source URLs, retrieval timestamps, and any robots/sitemap failures.
3. Show the isolated market specialist task and its cited competitor/search-intent evidence.
4. Show `backlog.json`: 3–7 scored opportunities, executable work first, exactly one selected action.
5. Open `draft.md` and explain the commercial before/after.
6. Open `qc.md`; the evaluator must genuinely reject unsupported claims, unverifiable links, conversion mismatch, or another rule violation if present.
7. Show the one bounded revision in `final.md` and stop at the explicit approve/revise/reject gate.
8. Show the `seo-operations-manager` skill and, only after cadence approval, the scheduled Telegram monitor.

## Run directory

Create `runs/<UTC timestamp>-<hostname>/` containing:

- `intake.json`
- `site-evidence.json`
- `market-evidence.md`
- `backlog.json`
- `draft.md`
- `qc.md`
- `final.md`
- `run-summary.md`

Run-specific artifacts are ignored by git. Keep an event-safe copy outside the repository if required for presentation.

## Live commands

```bash
npm run seo:collect -- https://business.example/service-page
npm test
npm run lint
npm run typecheck
npm run build
hermes gateway status
hermes cron list --all
```

## Approval boundary

The system may research, read public pages, draft, evaluate, revise, save local artifacts, and propose a schedule. It must not publish, alter the target website, deploy target-business code, perform outreach, buy links, or make destructive changes without explicit user approval.

## Fallback path

If a public page blocks live collection, show the failure in the fresh run and use the latest timestamped cached evidence only for the remaining presentation. Clearly label cached evidence and its retrieval time. Never replace failed live output with invented success.
