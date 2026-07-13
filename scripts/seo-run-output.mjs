import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_ARTIFACT_BYTES } from "./seo-run-contract.mjs";

const PACKAGE_FIELDS = [
  "marketEvidence",
  "backlog",
  "draft",
  "qualityReview",
  "final",
  "runState",
  "runSummary",
];

const OUTPUT_FILES = {
  marketEvidence: "market-evidence.md",
  backlog: "backlog.json",
  draft: "draft.md",
  qualityReview: "qc.md",
  final: "final.md",
  runState: "run-state.json",
  runSummary: "run-summary.md",
};

function validatePackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent output package must be an object.");
  }
  const keys = Object.keys(value);
  const unexpected = keys.filter((key) => !PACKAGE_FIELDS.includes(key));
  if (unexpected.length) throw new Error(`Agent output contains unexpected fields: ${unexpected.join(", ")}.`);
  for (const field of PACKAGE_FIELDS) {
    if (!(field in value)) throw new Error(`Agent output is missing ${field}.`);
  }
  for (const field of ["marketEvidence", "draft", "qualityReview", "final", "runSummary"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new Error(`Agent output field ${field} must be non-empty text.`);
    }
  }
  if (!Array.isArray(value.backlog)) throw new Error("Agent output field backlog must be an array.");
  if (!value.runState || typeof value.runState !== "object" || Array.isArray(value.runState)) {
    throw new Error("Agent output field runState must be an object.");
  }
  return value;
}

export function parseAgentPackage(output) {
  if (typeof output !== "string" || output.length > 1024 * 1024) {
    throw new Error("Agent output is missing or exceeds the 1 MB limit.");
  }
  const fenced = output.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced ?? output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
  if (!candidate) throw new Error("Agent output did not contain a JSON package.");
  try {
    return validatePackage(JSON.parse(candidate));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Agent output package is not valid JSON.");
    throw error;
  }
}

export async function writeAgentPackage(runDirectory, packageValue) {
  const validated = validatePackage(packageValue);
  await Promise.all(PACKAGE_FIELDS.map(async (field) => {
    const value = field === "backlog" || field === "runState"
      ? JSON.stringify(validated[field], null, 2)
      : validated[field];
    if (Buffer.byteLength(value, "utf8") > MAX_ARTIFACT_BYTES) {
      throw new Error(`${field} exceeds the 256 KB artifact limit.`);
    }
    const destination = path.join(runDirectory, OUTPUT_FILES[field]);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, value, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  }));
}
