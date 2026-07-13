"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BriefResult } from "../lib/brief";
import type { DashboardAudit } from "../lib/seo/dashboard-audit";
import type { WebsiteEvidenceReport } from "../lib/seo/evidence";

type AuditResponse = {
  brief: Extract<BriefResult, { ok: true }>;
  audit: DashboardAudit;
  evidence: WebsiteEvidenceReport;
  run: RunStatus;
};

type RunStatus = {
  runId: string;
  status: "starting" | "running" | "complete" | "failed";
  startedAt: string;
  finishedAt?: string;
  message: string;
  timeoutAt?: string;
  errorCode?: string;
  exitCode?: number | null;
  validationErrors?: string[];
  artifacts?: {
    finalCopy: string | null;
    qualityReview: string | null;
    summary: string | null;
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

const initialStages = [
  ["01", "SEO Operations Manager", "Plans the run, coordinates handoffs and owns approval state."],
  ["02", "Site & Technical Auditor", "Inspects pages, rendering, metadata, indexability and conversion paths."],
  ["03", "Market & Intent Researcher", "Investigates buyers, competitors, search intent and evidence."],
  ["04", "SEO Strategist & Builder", "Maps keyword themes, clusters, priorities and one deliverable."],
  ["05", "Evidence & QC Reviewer", "Rejects unsupported work and verifies the bounded revision."],
];

function stageLabel(status: string): string {
  if (status === "complete") return "Complete";
  if (status === "working" || status === "running" || status === "starting") return "Working";
  if (status === "failed") return "Needs attention";
  if (status === "preliminary") return "Preliminary";
  return "Waiting";
}

function elapsedLabel(startedAt: string, finishedAt: string | undefined, now: number): string {
  const end = finishedAt ? Date.parse(finishedAt) : now;
  const elapsedSeconds = Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AuditDashboard() {
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const runId = result?.run.runId;
  const runStatus = result?.run.status;

  useEffect(() => {
    if (!runId || !runStatus || !["starting", "running"].includes(runStatus)) return;

    const controller = new AbortController();
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Status request failed with HTTP ${response.status}.`);
        const run = await response.json() as RunStatus;
        setPollError(null);
        setResult((current) => current?.run.runId === runId ? { ...current, run } : current);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setPollError(caught instanceof Error ? caught.message : "Live status could not be refreshed.");
        }
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(poll, 3000);
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
    setError(null);
    setPollError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.get("url") }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Audit could not be started.");
      }
      setResult(payload as AuditResponse);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Audit could not be started.");
    } finally {
      setPending(false);
    }
  }

  const agentStages = result ? initialStages.map((_, position) => {
    const liveStage = result.run.progress?.stages[position];
    if (liveStage) return liveStage;
    if (position === 0) {
      return { status: result.run.status, detail: result.run.message };
    }
    if (position === 1) {
      return result.audit.stages.websiteUnderstanding;
    }
    return { status: "waiting", detail: "Waiting for the preceding evidence handoff." };
  }) : [];

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">SEO</span>
          <span>Agent<br />Orchestrator</span>
        </div>
        <nav className="sideNav" aria-label="Dashboard navigation">
          <a className="active" href="#new-audit"><span>01</span> Intake</a>
          <a href="#workflow"><span>02</span> Agents</a>
          <a href="#results"><span>03</span> Evidence</a>
          <a href="#evidence"><span>04</span> Output</a>
        </nav>
        <div className="sidebarFooter">
          <span className="statusDot" /> Local Hermes workflow
          <small>No publishing or site changes</small>
        </div>
      </aside>

      <main className="dashboardMain">
        <header className="topbar">
          <div className="heroHeading">
            <span className="eyebrow">SPECIALIST AGENT SYSTEM · LOCAL / EVIDENCE-FIRST</span>
            <h1><span>SEO AGENT</span><span>ORCHESTRATOR</span></h1>
            <p className="heroStatement">Evidence stays visible. Agents handle the search work.</p>
          </div>
          <div className="heroMeta">
            <span className="phasePill">PHASE 01 · RECOMMEND</span>
            <small>No publishing. No hidden execution.</small>
          </div>
        </header>

        <section id="new-audit" className="auditCard">
          <div className="cardHeading">
            <div>
              <span className="sectionIndex">01 / START</span>
              <h2>Give the system a domain.</h2>
            </div>
            <span className="secureLabel">Local runtime</span>
          </div>

          <form onSubmit={submit} className="auditForm simpleForm">
            <label className="wideField">
              <span>Website URL</span>
              <input name="url" type="url" required autoFocus placeholder="https://yourcompany.com" />
            </label>
            <button className="primaryButton" type="submit" disabled={pending}>
              {pending ? "Starting agents…" : "Start agents"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="formHint">Public HTTP(S) URLs only · analysis stays local · the target site is never modified</p>
          {error && <p className="errorMessage" role="alert">{error}</p>}
          {result && (
            <div className={`runBanner ${result.run.status}`} role="status">
              <span className={`statusDot ${["starting", "running"].includes(result.run.status) ? "isActive" : ""}`} />
              <div>
                <strong>{stageLabel(result.run.status)} · {elapsedLabel(result.run.startedAt, result.run.finishedAt, now)}</strong>
                <p>{result.run.message}</p>
              </div>
              <code>{result.run.runId}</code>
            </div>
          )}
          {pollError && <p className="pollWarning" role="alert">Live updates interrupted: {pollError} Retrying automatically.</p>}
        </section>

        <section id="workflow" className="workflowSection">
          <div className="sectionTitle">
            <div>
              <span className="sectionIndex">02 / WORKFLOW</span>
              <h2>Five agents. One evidence chain.</h2>
            </div>
            <p>Each specialist waits for the evidence it needs. Nothing advances on simulated progress.</p>
          </div>
          <div className="workflowGrid">
            {initialStages.map(([index, title, description], position) => {
              const liveStage = agentStages[position];
              return (
                <article className="workflowStep" key={index}>
                  <div className="stepTop">
                    <span>{index}</span>
                    <span className={`stepStatus ${liveStage?.status ?? "idle"}`}>
                      {liveStage ? stageLabel(liveStage.status) : "Waiting"}
                    </span>
                  </div>
                  <h3>{title}</h3>
                  <p>{liveStage?.detail ?? description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {result && (
          <section className="activitySection" aria-labelledby="activity-title">
            <div className="sectionTitle">
              <div>
                <span className="sectionIndex">03 / LIVE ACTIVITY</span>
                <h2 id="activity-title">What the agents are doing</h2>
              </div>
              <p>{result.run.progress?.percent ?? 4}% · elapsed {elapsedLabel(result.run.startedAt, result.run.finishedAt, now)}</p>
            </div>

            <div className={`activityPanel ${result.run.status}`}>
              <div className="progressTrack" aria-label={`${result.run.progress?.percent ?? 4}% complete`}>
                <span style={{ width: `${result.run.progress?.percent ?? 4}%` }} />
              </div>

              {result.run.timeoutAt && ["starting", "running"].includes(result.run.status) && (
                <p className="safetyNote">Safety timer active · automatic stop at {new Date(result.run.timeoutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} if the workflow stalls or loops.</p>
              )}

              {result.run.status === "failed" && (
                <div className="runError" role="alert">
                  <strong>Run needs attention</strong>
                  <p>{result.run.message}</p>
                  {!!result.run.progress?.missingArtifacts.length && (
                    <p>Missing deliverables: {result.run.progress.missingArtifacts.join(", ")}</p>
                  )}
                  {!!result.run.validationErrors?.length && (
                    <p>Validation errors: {result.run.validationErrors.join(" ")}</p>
                  )}
                </div>
              )}

              <ol className="activityTimeline">
                {(result.run.progress?.events ?? []).map((event) => (
                  <li key={`${event.at}-${event.label}`}>
                    <span className="timelineMarker" />
                    <div>
                      <strong>{event.label}</strong>
                      <p>{event.detail}</p>
                    </div>
                    <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                  </li>
                ))}
                {["starting", "running"].includes(result.run.status) && (
                  <li className="activeEvent">
                    <span className="timelineMarker" />
                    <div>
                      <strong>Agents are processing the next evidence handoff</strong>
                      <p>The timeline updates only when a real run artifact is saved.</p>
                    </div>
                    <span className="loadingDots" aria-label="Working"><i /><i /><i /></span>
                  </li>
                )}
              </ol>
            </div>
          </section>
        )}

        <section id="results" className="resultsSection">
          <div className="sectionTitle">
            <div>
              <span className="sectionIndex">{result ? "04" : "03"} / LIVE EVIDENCE</span>
              <h2>{result ? result.audit.business.host : "The evidence field opens after inspection."}</h2>
            </div>
            {result && <span className="retrievedAt">Retrieved {new Date(result.evidence.collectedAt).toLocaleString()}</span>}
          </div>

          {!result ? (
            <div className="emptyState">
              <span className="emptyIcon" aria-hidden="true">03</span>
              <p>Submit a public website to begin diagnostics, market research, strategy, copy generation and independent review.</p>
              <a className="emptyAction" href="#new-audit">Enter a domain ↑</a>
            </div>
          ) : (
            <div className="resultsGrid">
              <article className="resultPanel overviewPanel">
                <span className="panelLabel">BUSINESS SNAPSHOT</span>
                <h3>{result.audit.business.title ?? "Untitled page"}</h3>
                <p>{result.audit.business.description ?? "No meta description found."}</p>
                <dl>
                  <div><dt>Primary H1</dt><dd>{result.audit.business.primaryHeading ?? "Missing"}</dd></div>
                  <div><dt>Fetched words</dt><dd>{result.audit.business.wordCount}</dd></div>
                  <div><dt>Indexable</dt><dd>{result.audit.business.indexable ? "Likely" : "Noindex detected"}</dd></div>
                  <div><dt>Brief score</dt><dd>{result.brief.score}/100</dd></div>
                </dl>
              </article>

              <article className="resultPanel">
                <span className="panelLabel">FIRST-PARTY KEYWORD SEEDS</span>
                <div className="chipList">
                  {result.audit.keywordSeeds.length ? result.audit.keywordSeeds.map((seed) => <span key={seed}>{seed}</span>) : <p>No heading-based seeds found.</p>}
                </div>
                <small>No search-volume or ranking claims are inferred.</small>
              </article>

              <article className="resultPanel clusterPanel">
                <span className="panelLabel">PRELIMINARY CLUSTERS</span>
                {result.audit.clusters.map((cluster) => (
                  <div className="clusterRow" key={cluster.name}>
                    <div><strong>{cluster.name}</strong><span>{cluster.evidenceBasis}</span></div>
                    <p>{cluster.themes.join(" · ") || "Awaiting more evidence"}</p>
                  </div>
                ))}
              </article>

              <article id="evidence" className="resultPanel findingsPanel">
                <span className="panelLabel">TECHNICAL FINDINGS</span>
                <ul>
                  {result.audit.findings.length ? result.audit.findings.map((finding) => <li key={finding}>{finding}</li>) : <li>No immediate extraction issues found.</li>}
                </ul>
              </article>

              {result.run.status === "complete" && result.run.artifacts?.finalCopy && (
                <article className="resultPanel copyPanel">
                  <span className="panelLabel">QC-REVIEWED COPY CANDIDATE</span>
                  <pre>{result.run.artifacts.finalCopy}</pre>
                  <small>Copy approval only. Nothing has been published or changed on the target site.</small>
                </article>
              )}

              {result.run.artifacts?.qualityReview && (
                <article className="resultPanel copyPanel">
                  <span className="panelLabel">INDEPENDENT QUALITY REVIEW</span>
                  <pre>{result.run.artifacts.qualityReview}</pre>
                </article>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
