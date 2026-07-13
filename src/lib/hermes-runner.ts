import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PageType } from "./brief";
import type { WebsiteEvidenceReport } from "./seo/evidence";

export type HermesRunArtifacts = {
  finalCopy: string | null;
  qualityReview: string | null;
  summary: string | null;
};

export type AgentStageStatus = "waiting" | "working" | "complete" | "failed";

export type HermesRunProgress = {
  percent: number;
  stages: Array<{
    id: "orchestrator" | "site-audit" | "market-research" | "strategy" | "quality-review";
    status: AgentStageStatus;
    detail: string;
  }>;
  events: Array<{ at: string; label: string; detail: string }>;
  missingArtifacts: string[];
};

export type HermesRunStatus = {
  runId: string;
  status: "starting" | "running" | "complete" | "failed";
  startedAt: string;
  finishedAt?: string;
  pid?: number;
  message: string;
  artifacts?: HermesRunArtifacts;
  progress?: HermesRunProgress;
  timeoutAt?: string;
};

type RunInput = {
  url: string;
  objective: string;
  pageType: PageType;
};

const RUN_ID_PATTERN = /^\d{8}T\d{6}Z-[a-z0-9-]{1,60}(?:-[a-f0-9]{8})?$/;
const MAX_DASHBOARD_ARTIFACT_BYTES = 256 * 1024;
const REQUIRED_ARTIFACTS = [
  "site-evidence.json",
  "market-evidence.md",
  "backlog.json",
  "draft.md",
  "qc.md",
  "final.md",
  "run-state.json",
  "run-summary.md",
] as const;

const MILESTONES = [
  { file: "site-evidence.json", label: "First-party diagnostics saved", detail: "The bounded page, robots and sitemap evidence packet is available.", percent: 12 },
  { file: "rendered-page-evidence.json", label: "Rendered page inspected", detail: "JavaScript-rendered content and conversion paths were checked.", percent: 24 },
  { file: "market-evidence.md", label: "Market evidence packet completed", detail: "Buyer intent and public competitor evidence were returned by the research specialist.", percent: 40 },
  { file: "backlog.json", label: "Opportunities prioritised", detail: "Evidence-backed opportunities were scored and one action was selected.", percent: 55 },
  { file: "draft.md", label: "Draft copy created", detail: "The strategist produced the first bounded copy candidate.", percent: 70 },
  { file: "qc.md", label: "Independent QC completed", detail: "The reviewer recorded its evidence and quality verdict.", percent: 84 },
  { file: "final.md", label: "Revised copy candidate ready", detail: "The bounded revision is available for copy approval.", percent: 94 },
  { file: "run-summary.md", label: "Run summary completed", detail: "The workflow recorded outcomes, unknowns and approval boundaries.", percent: 100 },
] as const;

function projectRoot(): string {
  return process.cwd();
}

function createRunId(url: string): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const host = new URL(url).hostname
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 50);
  return `${timestamp}-${host || "website"}-${randomBytes(4).toString("hex")}`;
}

function statusPath(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("Invalid run ID.");
  return path.join(projectRoot(), "runs", runId, "dashboard-status.json");
}

async function readOptionalArtifact(filePath: string): Promise<string | null> {
  try {
    const details = await stat(filePath);
    if (!details.isFile() || details.size === 0 || details.size > MAX_DASHBOARD_ARTIFACT_BYTES) {
      return null;
    }
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readRunArtifacts(runDirectory: string): Promise<HermesRunArtifacts> {
  const [finalCopy, qualityReview, summary] = await Promise.all([
    readOptionalArtifact(path.join(runDirectory, "final.md")),
    readOptionalArtifact(path.join(runDirectory, "qc.md")),
    readOptionalArtifact(path.join(runDirectory, "run-summary.md")),
  ]);
  return { finalCopy, qualityReview, summary };
}

async function existingFiles(runDirectory: string): Promise<Map<string, Date>> {
  const files = [...new Set([...MILESTONES.map(({ file }) => file), ...REQUIRED_ARTIFACTS])];
  const entries = await Promise.all(files.map(async (file) => {
    try {
      const details = await stat(path.join(runDirectory, file));
      if (!details.isFile() || details.size === 0 || details.size > MAX_DASHBOARD_ARTIFACT_BYTES) {
        return null;
      }
      return [file, details.mtime] as const;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }));
  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
}

export async function buildRunView(
  storedStatus: HermesRunStatus,
  runDirectory: string,
): Promise<HermesRunStatus & { artifacts: HermesRunArtifacts; progress: HermesRunProgress }> {
  const [artifacts, files] = await Promise.all([
    readRunArtifacts(runDirectory),
    existingFiles(runDirectory),
  ]);
  const missingArtifacts = REQUIRED_ARTIFACTS.filter((file) => !files.has(file));
  const incompleteSuccess = storedStatus.status === "complete" && missingArtifacts.length > 0;
  const status = incompleteSuccess ? "failed" : storedStatus.status;
  const active = status === "starting" || status === "running";
  const failed = status === "failed";
  const has = (file: string) => files.has(file);
  const stageStatus = (complete: boolean, ready: boolean): AgentStageStatus => {
    if (complete) return "complete";
    if (failed) return "failed";
    return active && ready ? "working" : "waiting";
  };
  const events = MILESTONES
    .filter(({ file }) => has(file))
    .map(({ file, label, detail }) => ({ at: files.get(file)!.toISOString(), label, detail }))
    .sort((left, right) => left.at.localeCompare(right.at));
  const calculatedPercent = status === "complete"
    ? 100
    : Math.max(4, ...MILESTONES.filter(({ file }) => has(file)).map(({ percent }) => percent));
  const percent = failed ? Math.min(calculatedPercent, 99) : calculatedPercent;

  return {
    ...storedStatus,
    status,
    message: incompleteSuccess
      ? `The agent stopped before producing ${missingArtifacts.length} required deliverables.`
      : storedStatus.message,
    artifacts,
    progress: {
      percent,
      missingArtifacts,
      events,
      stages: [
        { id: "orchestrator", status: stageStatus(status === "complete", true), detail: active ? "Coordinating evidence handoffs and watching completion gates." : status === "complete" ? "Workflow and approval package completed." : "Workflow stopped before all gates passed." },
        { id: "site-audit", status: stageStatus(has("site-evidence.json"), true), detail: has("rendered-page-evidence.json") ? "Static and rendered website evidence saved." : has("site-evidence.json") ? "Initial static diagnostics saved; rendered verification may follow." : "Waiting for first-party diagnostics." },
        { id: "market-research", status: stageStatus(has("market-evidence.md"), has("site-evidence.json")), detail: has("market-evidence.md") ? "Cited market and search-intent evidence saved." : failed ? "Market evidence was not completed." : "Researching buyer intent and public competitor evidence." },
        { id: "strategy", status: stageStatus(has("final.md"), has("market-evidence.md")), detail: has("final.md") ? "Final bounded copy candidate saved." : failed ? "The strategy and final copy package were not completed." : has("draft.md") ? "Draft created; revision and evidence checks are in progress." : has("market-evidence.md") ? "Ranking opportunities and building one deliverable." : "Waiting for site and market evidence." },
        { id: "quality-review", status: stageStatus(has("qc.md"), has("draft.md")), detail: has("qc.md") ? "Independent QC verdict saved." : failed ? "Independent QC was not completed." : has("draft.md") ? "Reviewing claims, links, conversion fit and approval boundaries." : "Waiting for the first draft." },
      ],
    },
  };
}

export async function startHermesRun(
  input: RunInput,
  evidence: WebsiteEvidenceReport,
): Promise<HermesRunStatus> {
  const runId = createRunId(input.url);
  const runDirectory = path.join(projectRoot(), "runs", runId);
  const status: HermesRunStatus = {
    runId,
    status: "starting",
    startedAt: new Date().toISOString(),
    message: "Starting the SEO Operations Manager and specialist agents.",
  };

  await mkdir(runDirectory, { recursive: false });
  await writeFile(
    path.join(runDirectory, "dashboard-request.json"),
    JSON.stringify({ ...input, runId, startedAt: status.startedAt }, null, 2),
    { encoding: "utf8", flag: "wx" },
  );
  await writeFile(
    path.join(runDirectory, "site-evidence.json"),
    JSON.stringify(evidence, null, 2),
    { encoding: "utf8", flag: "wx" },
  );
  await writeFile(statusPath(runId), JSON.stringify(status, null, 2), "utf8");

  const worker = spawn(
    process.execPath,
    [path.join(projectRoot(), "scripts", "run-hermes-seo-agent.mjs"), runId],
    {
      cwd: projectRoot(),
      detached: true,
      stdio: "ignore",
    },
  );
  worker.unref();

  return await new Promise((resolve, reject) => {
    worker.once("spawn", () => resolve(status));
    worker.once("error", reject);
  });
}

export async function getHermesRunStatus(runId: string): Promise<HermesRunStatus | null> {
  try {
    const status = JSON.parse(await readFile(statusPath(runId), "utf8")) as HermesRunStatus;
    return await buildRunView(status, path.dirname(statusPath(runId)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
