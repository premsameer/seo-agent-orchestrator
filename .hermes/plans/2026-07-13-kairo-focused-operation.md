# Kairo Focused SEO Operation Implementation Plan

> **For Hermes:** Implement task-by-task with strict TDD and preserve the existing editorial monitor UI.

**Goal:** Extend the current product into Kairo: one URL + objective produces business understanding, exactly three scored opportunities, one selected commercial-page improvement, an independent rejection/revision record, and copy/download actions.

**Architecture:** Keep the current evidence collector, detached Hermes worker, status polling, timeout, and artifact contract. Add a validated structured `operation-result.json` to the existing agent package, expose it through run status, and render it through focused Kairo sections. Provide a clearly labelled static sample using the same schema for video fallback.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Node worker scripts.

---

1. Add a typed Kairo operation result schema and realistic sample fixture; test exactly three opportunities, transparent score calculation, selected ID, commercial-page recommendation, and QC rejection/revision.
2. Extend the agent output package and artifact contract to require `operationResult`; validate structured fields before persistence and handoff.
3. Extend intake validation for required growth objective and optional target market; pass both into the worker prompt.
4. Update the worker prompt to four customer-facing roles and one structured commercial-page deliverable with one bounded QC revision.
5. Extend run status with structured result data and focused evidence-led stage/event labels.
6. Refactor the existing dashboard in place: Kairo hero, objective/market form, four steps/roles, sample mode, business summary, exactly three opportunities, selected rationale, original-vs-recommended comparison, visible QC loop, and final actions.
7. Add copy, report download, start-another, retry, duplicate-submit prevention, timeout and extraction failure states.
8. Run targeted tests after each vertical slice, then full test/lint/typecheck/security/build and production browser verification.
