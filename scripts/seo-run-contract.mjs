import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const MAX_ARTIFACT_BYTES = 256 * 1024;
export const REQUIRED_RUN_ARTIFACTS = [
  "site-evidence.json",
  "market-evidence.md",
  "backlog.json",
  "draft.md",
  "qc.md",
  "final.md",
  "run-state.json",
  "run-summary.md",
];

const JSON_ARTIFACTS = ["site-evidence.json", "backlog.json", "run-state.json"];
const READY_STATES = new Set(["AWAITING_COPY_APPROVAL", "COPY_APPROVED"]);

async function inspectArtifact(runDirectory, file) {
  try {
    const details = await stat(path.join(runDirectory, file));
    if (!details.isFile() || details.size === 0) return { file, missing: true };
    if (details.size > MAX_ARTIFACT_BYTES) return { file, oversized: true };
    return { file, content: await readFile(path.join(runDirectory, file), "utf8") };
  } catch (error) {
    if (error?.code === "ENOENT") return { file, missing: true };
    throw error;
  }
}

export async function validateRunArtifacts(runDirectory) {
  const inspected = await Promise.all(
    REQUIRED_RUN_ARTIFACTS.map((file) => inspectArtifact(runDirectory, file)),
  );
  const byFile = new Map(inspected.map((artifact) => [artifact.file, artifact]));
  const missingArtifacts = inspected
    .filter((artifact) => artifact.missing)
    .map((artifact) => artifact.file);
  const errors = inspected
    .filter((artifact) => artifact.oversized)
    .map((artifact) => `${artifact.file} exceeds the 256 KB artifact limit.`);

  for (const file of JSON_ARTIFACTS) {
    const artifact = byFile.get(file);
    if (!artifact?.content) continue;
    try {
      JSON.parse(artifact.content);
    } catch {
      errors.push(`${file} is not valid JSON.`);
    }
  }

  const stateArtifact = byFile.get("run-state.json");
  if (stateArtifact?.content) {
    try {
      const runState = JSON.parse(stateArtifact.content);
      if (!READY_STATES.has(runState.status)) {
        errors.push("run-state.json is not awaiting copy approval.");
      }
    } catch {
      // The malformed JSON error above is sufficient.
    }
  }

  const qcArtifact = byFile.get("qc.md");
  if (qcArtifact?.content) {
    const verdicts = [...qcArtifact.content.matchAll(/\bVerdict\s*:\s*(PASS|REJECT)\b/gi)];
    const finalVerdict = verdicts.at(-1)?.[1]?.toUpperCase();
    if (finalVerdict !== "PASS") errors.push("The final QC verdict is not PASS.");
  }

  return {
    valid: missingArtifacts.length === 0 && errors.length === 0,
    errors,
    missingArtifacts,
  };
}
