"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { BriefResult } from "../lib/brief";
import {
  GROWTH_OBJECTIVES,
  KAIRO_SAMPLE_OPERATION,
  type KairoOperationResult,
} from "../lib/kairo-operation";
import type { DashboardAudit } from "../lib/seo/dashboard-audit";
import type { WebsiteEvidenceReport } from "../lib/seo/evidence";

type RunStatus = {
  runId: string;
  status: "starting" | "running" | "complete" | "failed";
  startedAt: string;
  finishedAt?: string;
  message: string;
  timeoutAt?: string;
  validationErrors?: string[];
  artifacts?: {
    operationResult: KairoOperationResult | null;
  };
  progress?: {
    percent: number;
    stages: Array<{
      id: string;
      status: "waiting" | "working" | "complete" | "failed";
      detail: string;
    }>;
    events: Array<{ at: string; label: string; detail: string }>;
    missingArtifacts: string[];
  };
};

type AuditResponse = {
  brief: Extract<BriefResult, { ok: true }>;
  audit: DashboardAudit;
  evidence: WebsiteEvidenceReport;
  run: RunStatus;
};

const roles = [
  {
    id: "business-analysis",
    index: "01",
    title: "Business Analyst",
    task: "Understand the offer, audience, conversion action, and commercial pages.",
    evidence: "Public website copy and user inputs",
    output: "Business understanding",
  },
  {
    id: "seo-research",
    index: "02",
    title: "SEO Researcher",
    task: "Inspect focused page signals and identify three actionable opportunities.",
    evidence: "Titles, metadata, headings, page coverage, and intent",
    output: "Three evidence-backed opportunities",
  },
  {
    id: "seo-operation",
    index: "03",
    title: "SEO Operator",
    task: "Score the opportunities, select one, and build the page improvement.",
    evidence: "Impact, confidence, effort, and commercial relevance",
    output: "One implementation-ready deliverable",
  },
  {
    id: "quality-review",
    index: "04",
    title: "Quality Reviewer",
    task: "Reject unsupported work, request one revision, and verify the result.",
    evidence: "Claim support, intent alignment, relevance, and brand fit",
    output: "Independent quality decision",
  },
] as const;

const sampleEvents = [
  ["00:04", "Business model identified", "Offer, buyer, conversion action, and target market mapped."],
  ["00:10", "Commercial pages found", "Primary service, pricing, and assessment pages inspected."],
  ["00:18", "Page titles and headings inspected", "Commercial intent and positioning gaps recorded."],
  ["00:29", "Three opportunities shortlisted", "Only immediate commercial actions were retained."],
  ["00:35", "Opportunity scores calculated", "Impact × confidence ÷ effort applied consistently."],
  ["00:41", "Highest-value action selected", "Existing SOC 2 page improvement selected."],
  ["00:54", "Commercial-page improvement drafted", "Title, hero, CTA, structure, FAQs, and links completed."],
  ["01:02", "Unsupported claim detected", "An unverified implementation timeline was rejected."],
  ["01:09", "Draft revised", "The timing promise was replaced with an evidence-backed process claim."],
  ["01:13", "Quality review passed", "Final recommendation passed all completion gates."],
] as const;

function statusLabel(status: string): string {
  if (status === "complete") return "Complete";
  if (["working", "running", "starting"].includes(status)) return "Working";
  if (status === "failed") return "Needs attention";
  return "Waiting";
}

function elapsedLabel(startedAt: string, finishedAt: string | undefined, now: number): string {
  const end = finishedAt ? Date.parse(finishedAt) : now;
  const seconds = Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function recommendationText(operation: KairoOperationResult): string {
  const recommendation = operation.recommendation;
  return [
    `KAIRO · ${operation.operationLabel}`,
    `Selected opportunity: ${operation.opportunities.find((item) => item.selected)?.title}`,
    "",
    `SEO title: ${recommendation.title}`,
    `Meta description: ${recommendation.metaDescription}`,
    `H1: ${recommendation.h1}`,
    `Hero headline: ${recommendation.heroHeadline}`,
    `Hero copy: ${recommendation.heroCopy}`,
    `Primary CTA: ${recommendation.primaryCta}`,
    "",
    "Recommended page structure:",
    ...recommendation.pageStructure.map((item) => `- ${item}`),
    "",
    "Sections to add or improve:",
    ...recommendation.sectionsToImprove.map((item) => `- ${item}`),
    "",
    "FAQ suggestions:",
    ...recommendation.faqs.map((item) => `- ${item}`),
    "",
    "Internal links:",
    ...recommendation.internalLinks.map((item) => `- ${item.anchor} → ${item.destination}`),
  ].join("\n");
}

function reportText(operation: KairoOperationResult): string {
  return [
    recommendationText(operation),
    "",
    "BUSINESS UNDERSTOOD",
    `Company: ${operation.business.company}`,
    `What it sells: ${operation.business.sells}`,
    `Target customer: ${operation.business.targetCustomer}`,
    `Primary conversion: ${operation.business.primaryConversion}`,
    `Target market: ${operation.business.targetMarket}`,
    `Commercial pages: ${operation.business.commercialPages.join(", ")}`,
    "",
    "THREE OPPORTUNITIES",
    ...operation.opportunities.flatMap((item) => [
      `${item.selected ? "[SELECTED] " : ""}${item.title} · ${item.page}`,
      `Impact ${item.impact}/5 · Confidence ${item.confidence}/5 · Effort ${item.effort}/5 · Score ${item.priorityScore}`,
      `Evidence: ${item.evidence.join(" | ")}`,
    ]),
    "",
    "WHY KAIRO SELECTED THIS",
    ...operation.selectionReasons.map((reason) => `- ${reason}`),
    "",
    "QUALITY REVIEW",
    `Initial verdict: ${operation.qualityReview.initialVerdict}`,
    ...(operation.qualityReview.revisionCount === 1 ? [
      `Rejected: ${operation.qualityReview.rejectedText}`,
      `Reason: ${operation.qualityReview.rejectionReason}`,
      `Revision: ${operation.qualityReview.revision.revised}`,
    ] : ["No revision required."]),
    `Final verdict: ${operation.qualityReview.finalVerdict}`,
    `Final quality score: ${operation.qualityReview.finalQualityScore}/100`,
    "",
    "EVIDENCE",
    ...operation.evidence.map((item) => `- ${item}`),
  ].join("\n");
}

export default function KairoDashboard({ hostedPreview = false }: { hostedPreview?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [sampleMode, setSampleMode] = useState(hostedPreview);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<{ message: string; retrying: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const runId = result?.run.runId;
  const runStatus = result?.run.status;
  const operation = sampleMode
    ? KAIRO_SAMPLE_OPERATION
    : result?.run.artifacts?.operationResult ?? null;

  useEffect(() => {
    if (!runId || !runStatus || !["starting", "running"].includes(runStatus)) return;
    const controller = new AbortController();
    let timer: number | undefined;
    const poll = async () => {
      let shouldRetry = true;
      try {
        const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          shouldRetry = response.status >= 500;
          throw new Error(payload?.error ?? `Status request failed with HTTP ${response.status}.`);
        }
        const run = await response.json() as RunStatus;
        setPollError(null);
        setResult((current) => current?.run.runId === runId ? { ...current, run } : current);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setPollError({
            message: caught instanceof Error ? caught.message : "Live status could not be refreshed.",
            retrying: shouldRetry,
          });
        }
      } finally {
        if (!controller.signal.aborted && shouldRetry) timer = window.setTimeout(poll, 3000);
      }
    };
    timer = window.setTimeout(poll, 3000);
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [runId, runStatus]);

  useEffect(() => {
    if (!runStatus || !["starting", "running"].includes(runStatus)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runStatus]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (hostedPreview) {
      setError("Live operations are available in the secure local worker. Use the complete sample result on this hosted preview.");
      return;
    }
    setError(null);
    setPollError(null);
    setSampleMode(false);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: form.get("url"),
          objective: form.get("objective"),
          targetMarket: form.get("targetMarket"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The operation could not be started.");
      setResult(payload as AuditResponse);
      window.setTimeout(() => document.querySelector("#agents")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "The operation could not be started.");
    } finally {
      setPending(false);
    }
  }

  function showSample() {
    setSampleMode(true);
    setResult(null);
    setError(null);
    window.setTimeout(() => document.querySelector("#decision")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function copyRecommendation() {
    if (!operation) return;
    await navigator.clipboard.writeText(recommendationText(operation));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReport() {
    if (!operation) return;
    const blob = new Blob([reportText(operation)], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "kairo-seo-operation-report.txt";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function resetOperation() {
    setResult(null);
    setSampleMode(false);
    setError(null);
    setCopied(false);
    document.querySelector("#operate")?.scrollIntoView({ behavior: "smooth" });
  }

  const liveStages = result?.run.progress?.stages ?? [];
  const events = sampleMode
    ? sampleEvents.map(([at, label, detail]) => ({ at, label, detail }))
    : result?.run.progress?.events.map((event) => ({
      at: new Date(event.at).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
      label: event.label,
      detail: event.detail,
    })) ?? [];

  return (
    <div className="appShell kairoShell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">K</span><span>Kairo</span></div>
        <nav className="sideNav" aria-label="Kairo navigation">
          <a className="active" href="#operate"><span>01</span> Operate</a>
          <a href="#agents"><span>02</span> Agents</a>
          <a href="#decision"><span>03</span> Decision</a>
          <a href="#deliverable"><span>04</span> Deliverable</a>
        </nav>
        <div className="sidebarFooter">
          <span className="statusDot" /> Approval-first execution
          <small>High-risk changes stay under your control</small>
        </div>
      </aside>

      <main className="dashboardMain">
        <header className="topbar kairoHero">
          <div className="heroHeading">
            <span className="eyebrow">KAIRO · AUTONOMOUS SEO OPERATOR</span>
            <h1><span>Find your best SEO opportunity.</span><span>Complete it in one run.</span></h1>
            <p className="heroStatement">Enter your website and growth goal. Kairo analyses the business, chooses the highest-value SEO action, creates the work, and independently verifies the result.</p>
            <div className="heroActions">
              <a className="primaryButton" href="#operate">Run SEO operation <span aria-hidden="true">→</span></a>
              <button className="secondaryButton" type="button" onClick={showSample}>View sample result</button>
            </div>
          </div>
          <div className="heroMeta"><span className="phasePill">ONE ACTION · COMPLETED</span><small>Evidence-led. Independently reviewed.</small></div>
        </header>

        <section className="processStrip" aria-label="Kairo process">
          {[
            ["01", "Analyse", "Understand the business"],
            ["02", "Prioritise", "Score three opportunities"],
            ["03", "Build", "Complete one improvement"],
            ["04", "Verify", "Review every claim"],
          ].map(([index, title, detail]) => (
            <div key={index}><span>{index}</span><strong>{title}</strong><small>{detail}</small></div>
          ))}
        </section>
        <div className="proofRow">
          <span>One prioritised recommendation</span><span>One completed deliverable</span>
          <span>Evidence behind every decision</span><span>Independent quality review</span>
        </div>

        <section id="operate" className="auditCard kairoIntake">
          <div className="cardHeading">
            <div><span className="sectionIndex">01 / START</span><h2>Start one focused operation.</h2></div>
            <span className="secureLabel">Approval-first</span>
          </div>
          <form ref={formRef} onSubmit={submit} className="auditForm kairoForm">
            <label className="wideField"><span>Website URL</span><input name="url" type="url" required autoFocus placeholder="https://yourcompany.com" /></label>
            <label><span>Growth objective</span><select name="objective" required defaultValue="Generate more qualified leads">{GROWTH_OBJECTIVES.map((objective) => <option key={objective}>{objective}</option>)}</select></label>
            <label><span>Target market <em>Optional</em></span><input name="targetMarket" type="text" maxLength={120} placeholder="e.g. Bengaluru, India or Global" /></label>
            <button className="primaryButton" type="submit" disabled={pending || hostedPreview}>{pending ? "Starting operation…" : hostedPreview ? "Hosted sample only" : "Start operation"}<span aria-hidden="true">→</span></button>
          </form>
          <p className="formHint">{hostedPreview ? "This hosted preview provides the complete sample operation. Live execution requires the secure local worker." : "Kairo analyses public website information and does not make changes to your website."}</p>
          {hostedPreview && <button className="textButton" type="button" onClick={showSample}>View complete sample operation ↑</button>}
          <div className="approvalNote"><strong>Approval-first execution</strong><p>Kairo can analyse, prioritise, and create autonomously. Website publishing and high-risk changes remain under user control.</p></div>
          {error && <div className="runError" role="alert"><strong>Operation could not start</strong><p>{error}</p><div className="inlineActions"><button type="button" onClick={() => formRef.current?.requestSubmit()}>Retry</button><button type="button" onClick={showSample}>Use sample result</button></div></div>}
          {result && <div className={`runBanner ${result.run.status}`} role="status"><span className={`statusDot ${["starting", "running"].includes(result.run.status) ? "isActive" : ""}`} /><div><strong>{statusLabel(result.run.status)} · {elapsedLabel(result.run.startedAt, result.run.finishedAt, now)}</strong><p>{result.run.message}</p></div><code>{result.run.runId}</code></div>}
          {pollError && <p className="pollWarning" role="alert">Live update interrupted: {pollError.message}{pollError.retrying ? " Retrying automatically." : " Start a new operation to continue."}</p>}
        </section>

        <section id="agents" className="workflowSection kairoAgents">
          <div className="sectionTitle"><div><span className="sectionIndex">02 / LIVE OPERATION</span><h2>Four roles. One verified result.</h2></div><p>Short decision summaries only. Private reasoning is never exposed.</p></div>
          {result && <div className="operationProgress"><div><strong>{result.run.progress?.percent ?? 4}%</strong><span>Elapsed {elapsedLabel(result.run.startedAt, result.run.finishedAt, now)}</span></div><div className="progressTrack"><span style={{ width: `${result.run.progress?.percent ?? 4}%` }} /></div></div>}
          {result?.run.status === "failed" && <div className="runError" role="alert"><strong>Operation needs attention</strong><p>{result.run.message}</p>{!!result.run.validationErrors?.length && <p>{result.run.validationErrors.join(" ")}</p>}<div className="inlineActions"><button type="button" onClick={() => formRef.current?.requestSubmit()}>Retry operation</button><button type="button" onClick={showSample}>Use sample result</button></div></div>}
          <div className="agentRoleGrid">
            {roles.map((role, index) => {
              const live = liveStages.find((stage) => stage.id === role.id);
              const status = sampleMode ? "complete" : live?.status ?? (result && index === 0 ? "working" : "waiting");
              return <article className={`agentRoleCard ${status}`} key={role.id}>
                <div className="stepTop"><span>{role.index}</span><span className={`stepStatus ${status}`}>{statusLabel(status)}</span></div>
                <h3>{role.title}</h3>
                <dl><div><dt>Current task</dt><dd>{live?.detail ?? role.task}</dd></div><div><dt>Evidence</dt><dd>{role.evidence}</dd></div><div><dt>Output</dt><dd>{role.output}</dd></div><div><dt>Confidence</dt><dd>{status === "complete" ? "High" : status === "working" ? "Building" : "Pending"}</dd></div></dl>
              </article>;
            })}
          </div>
          {(result || sampleMode) && <div className="activityPanel"><span className="panelLabel">EVIDENCE-LED TIMELINE</span><ol className="activityTimeline">{events.map((event) => <li key={`${event.at}-${event.label}`}><span className="timelineMarker" /><div><strong>{event.label}</strong><p>{event.detail}</p></div><time>{event.at}</time></li>)}{result && ["starting", "running"].includes(result.run.status) && <li className="activeEvent"><span className="timelineMarker" /><div><strong>Kairo is processing the next evidence handoff</strong><p>The timeline advances only when a real artifact is validated.</p></div><span className="loadingDots"><i /><i /><i /></span></li>}</ol></div>}
        </section>

        {operation && <OperationResult operation={operation} onCopy={copyRecommendation} onDownload={downloadReport} onReset={resetOperation} copied={copied} />}

        {!operation && !result && !sampleMode && <section id="decision" className="resultsSection"><div className="emptyState"><span className="emptyIcon" aria-hidden="true">03</span><h2>Kairo chooses, completes, and verifies the next action.</h2><p>Start an operation or open the reliable sample result for the complete decision flow.</p><button className="emptyAction" type="button" onClick={showSample}>View sample result ↑</button></div></section>}
      </main>
    </div>
  );
}

function OperationResult({ operation, onCopy, onDownload, onReset, copied }: {
  operation: KairoOperationResult;
  onCopy: () => void;
  onDownload: () => void;
  onReset: () => void;
  copied: boolean;
}) {
  const selected = operation.opportunities.find((item) => item.selected)!;
  const rankedOpportunities = [...operation.opportunities].sort((left, right) =>
    Number(right.selected) - Number(left.selected) || right.priorityScore - left.priorityScore
  );
  return <>
    <section id="decision" className="resultsSection operationResults">
      <div className="sectionTitle"><div><span className="sectionIndex">03 / DECISION</span><h2>Business understood.</h2></div>{operation.sample && <span className="sampleBadge">Sample data · fictional company</span>}</div>
      <article className="businessSummary">
        <dl><div><dt>Company</dt><dd>{operation.business.company}</dd></div><div><dt>What it sells</dt><dd>{operation.business.sells}</dd></div><div><dt>Target customer</dt><dd>{operation.business.targetCustomer}</dd></div><div><dt>Primary conversion</dt><dd>{operation.business.primaryConversion}</dd></div><div><dt>Target market</dt><dd>{operation.business.targetMarket}</dd></div><div><dt>Commercial pages found</dt><dd>{operation.business.commercialPages.join(" · ")}</dd></div></dl>
      </article>

      <div className="decisionHeading"><div><span className="panelLabel">EXACTLY THREE OPPORTUNITIES</span><h2>One action rises above the rest.</h2></div><p><strong>Priority score</strong> = Impact × Confidence ÷ Effort<br /><small>A transparent prioritisation aid, not a precise forecast.</small></p></div>
      <div className="opportunityGrid">{rankedOpportunities.map((item) => <article className={`opportunityCard ${item.selected ? "selected" : ""}`} key={item.id}>{item.selected && <span className="selectedFlag">Kairo selected</span>}<span className="panelLabel">{item.page}</span><h3>{item.title}</h3><div className="scoreBand"><strong>{item.priorityScore}</strong><span>Priority score</span></div><div className="ratingRow"><span>Impact <b>{item.impact}/5</b></span><span>Confidence <b>{item.confidence}/5</b></span><span>Effort <b>{item.effort}/5</b></span></div><p>{item.explanation}</p><div className="intentLabel">{item.commercialIntent} commercial intent</div><ul>{item.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>{item.selected && <a className="selectedContinuation" href="#deliverable">View completed recommendation ↓</a>}</article>)}</div>
      <article className="selectionRationale"><div><span className="sectionIndex">SELECTED · {selected.priorityScore}</span><h2>Why Kairo selected this.</h2></div><ul>{operation.selectionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>
    </section>

    <section id="deliverable" className="deliverableSection">
      <div className="sectionTitle"><div><span className="sectionIndex">04 / COMPLETED WORK</span><h2>Original vs Kairo recommendation.</h2></div><div className="deliverableMeta">{operation.sample && <span className="sampleBadge">Sample data · fictional company</span>}<p>Changed areas are highlighted for implementation.</p></div></div>
      <div className="comparisonGrid">
        <article className="comparisonPanel original"><span className="panelLabel">ORIGINAL PAGE</span><h3>{operation.originalPage.url}</h3><ComparisonField label="SEO title" value={operation.originalPage.title} /><ComparisonField label="Meta description" value={operation.originalPage.metaDescription} /><ComparisonField label="H1" value={operation.originalPage.h1} /><ComparisonField label="Hero copy" value={operation.originalPage.heroCopy} /><ComparisonField label="Page structure" value={operation.originalPage.structure.join(" → ")} /><ComparisonField label="Primary CTA" value="Not detected above the fold" /></article>
        <article className="comparisonPanel recommended"><span className="panelLabel">KAIRO RECOMMENDATION</span><h3>Commercial page improvement</h3><ComparisonField label="SEO title" value={operation.recommendation.title} changed /><ComparisonField label="Meta description" value={operation.recommendation.metaDescription} changed /><ComparisonField label="H1" value={operation.recommendation.h1} changed /><ComparisonField label="Hero copy" value={`${operation.recommendation.heroHeadline}\n${operation.recommendation.heroCopy}`} changed /><ComparisonField label="Page structure" value={operation.recommendation.pageStructure.join(" → ")} changed /><ComparisonField label="Primary CTA" value={operation.recommendation.primaryCta} changed /></article>
      </div>
      <div className="recommendationDetails"><article><span className="panelLabel">RECOMMENDED PAGE STRUCTURE</span><ol>{operation.recommendation.pageStructure.map((item) => <li key={item}>{item}</li>)}</ol></article><article><span className="panelLabel">SECTIONS TO ADD OR IMPROVE</span><ul>{operation.recommendation.sectionsToImprove.map((item) => <li key={item}>{item}</li>)}</ul></article><article><span className="panelLabel">FAQ SUGGESTIONS</span><ul>{operation.recommendation.faqs.map((item) => <li key={item}>{item}</li>)}</ul></article><article><span className="panelLabel">INTERNAL LINKS</span><ul>{operation.recommendation.internalLinks.map((item) => <li key={item.anchor}><strong>{item.anchor}</strong><span>{item.destination}</span></li>)}</ul></article></div>

      {operation.qualityReview.revisionCount === 1 ? <div className="qualityLoop">
        <div className="qualityFailed"><span className="reviewVerdict">Quality review failed</span><blockquote>{operation.qualityReview.rejectedText}</blockquote><dl><div><dt>Reason for rejection</dt><dd>{operation.qualityReview.rejectionReason}</dd></div><div><dt>Required revision</dt><dd>{operation.qualityReview.requiredRevision}</dd></div></dl></div>
        <div className="qualityPassed"><span className="reviewVerdict">Revision completed</span><div className="revisionCompare"><p><small>Original statement</small>{operation.qualityReview.revision.original}</p><p><small>Revised statement</small>{operation.qualityReview.revision.revised}</p></div><strong>Final review result · {operation.qualityReview.finalVerdict}</strong></div>
      </div> : <div className="qualityLoop"><div className="qualityPassed"><span className="reviewVerdict">Passed first review</span><strong>No revision was required · {operation.qualityReview.finalVerdict}</strong></div></div>}
      <article className="qualityScore"><div><span className="panelLabel">FINAL QUALITY SCORE</span><strong>{operation.qualityReview.finalQualityScore}</strong><small>/100</small><p>Pass threshold 85 · no blocking claim failures</p></div><dl><div><dt>Claims verified · 25 points</dt><dd>{operation.qualityReview.claimsVerified}</dd></div><div><dt>Search intent · 25 points</dt><dd>{operation.qualityReview.searchIntent}</dd></div><div><dt>Business relevance · 25 points</dt><dd>{operation.qualityReview.businessRelevance}</dd></div><div><dt>Brand fit · 25 points</dt><dd>{operation.qualityReview.brandFit}</dd></div><div><dt>Revision deduction</dt><dd>{100 - operation.qualityReview.finalQualityScore} points deducted after {operation.qualityReview.revisionCount} bounded revision</dd></div></dl></article>

      <div className="handoffNote"><strong>Approval handoff ready</strong><span>Copy and download include only the final independently reviewed recommendation.</span></div><div className="finalActions"><button className="primaryButton" type="button" onClick={onCopy}>{copied ? "Copied" : "Copy final recommendation"}</button><button className="secondaryButton" type="button" onClick={onDownload}>Download report</button><button className="textButton" type="button" onClick={onReset}>Start another operation ↑</button></div>
    </section>
  </>;
}

function ComparisonField({ label, value, changed = false }: { label: string; value: string; changed?: boolean }) {
  return <div className={`comparisonField ${changed ? "changed" : ""}`}><span>{label}</span><p>{value || "Not detected"}</p></div>;
}
