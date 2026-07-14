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
  "operationResult",
];

const OUTPUT_FILES = {
  marketEvidence: "market-evidence.md",
  backlog: "backlog.json",
  draft: "draft.md",
  qualityReview: "qc.md",
  final: "final.md",
  runState: "run-state.json",
  runSummary: "run-summary.md",
  operationResult: "operation-result.json",
};

function scoreOpportunity(opportunity) {
  return Number(((opportunity.impact * opportunity.confidence) / opportunity.effort).toFixed(2));
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty text.`);
}

function requireTextArray(value, field, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must contain at least ${minimum} text item${minimum === 1 ? "" : "s"}.`);
  }
}

function validateOperationResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("operationResult must be an object.");
  if (!Array.isArray(result.opportunities) || result.opportunities.length !== 3) throw new Error("operationResult must contain exactly three opportunities.");
  const selected = result.opportunities.filter((opportunity) => opportunity.selected);
  if (selected.length !== 1 || selected[0]?.id !== result.selectedOpportunityId) throw new Error("operationResult must select exactly one opportunity.");
  for (const opportunity of result.opportunities) {
    requireText(opportunity.id, "operationResult.opportunity.id");
    requireText(opportunity.title, `operationResult.opportunity.${opportunity.id}.title`);
    requireText(opportunity.page, `operationResult.opportunity.${opportunity.id}.page`);
    requireText(opportunity.explanation, `operationResult.opportunity.${opportunity.id}.explanation`);
    requireTextArray(opportunity.evidence, `operationResult.opportunity.${opportunity.id}.evidence`);
    if (opportunity.priorityScore !== scoreOpportunity(opportunity)) throw new Error(`operationResult opportunity ${opportunity.id} has an invalid priority score.`);
  }
  if (result.recommendation?.type !== "commercial-page-improvement") throw new Error("operationResult must contain one commercial-page improvement.");
  if (result.qualityReview?.initialVerdict !== "REJECT" || result.qualityReview?.finalVerdict !== "PASS" || result.qualityReview?.revisionCount !== 1) throw new Error("operationResult must contain one rejection and one passing revision.");
  const requiredText = {
    "operationResult.operationLabel": result.operationLabel,
    "operationResult.business.company": result.business?.company,
    "operationResult.business.sells": result.business?.sells,
    "operationResult.business.targetCustomer": result.business?.targetCustomer,
    "operationResult.business.primaryConversion": result.business?.primaryConversion,
    "operationResult.originalPage.url": result.originalPage?.url,
    "operationResult.originalPage.title": result.originalPage?.title,
    "operationResult.originalPage.metaDescription": result.originalPage?.metaDescription,
    "operationResult.originalPage.h1": result.originalPage?.h1,
    "operationResult.originalPage.heroCopy": result.originalPage?.heroCopy,
    "operationResult.recommendation.title": result.recommendation?.title,
    "operationResult.recommendation.metaDescription": result.recommendation?.metaDescription,
    "operationResult.recommendation.h1": result.recommendation?.h1,
    "operationResult.recommendation.heroHeadline": result.recommendation?.heroHeadline,
    "operationResult.recommendation.heroCopy": result.recommendation?.heroCopy,
    "operationResult.recommendation.primaryCta": result.recommendation?.primaryCta,
    "operationResult.qualityReview.rejectedText": result.qualityReview?.rejectedText,
    "operationResult.qualityReview.rejectionReason": result.qualityReview?.rejectionReason,
    "operationResult.qualityReview.requiredRevision": result.qualityReview?.requiredRevision,
    "operationResult.qualityReview.revision.original": result.qualityReview?.revision?.original,
    "operationResult.qualityReview.revision.revised": result.qualityReview?.revision?.revised,
  };
  for (const [field, value] of Object.entries(requiredText)) requireText(value, field);
  requireTextArray(result.business?.commercialPages, "operationResult.business.commercialPages");
  requireTextArray(result.originalPage?.structure, "operationResult.originalPage.structure");
  requireTextArray(result.recommendation?.pageStructure, "operationResult.recommendation.pageStructure", 4);
  requireTextArray(result.recommendation?.sectionsToImprove, "operationResult.recommendation.sectionsToImprove");
  requireTextArray(result.recommendation?.faqs, "operationResult.recommendation.faqs", 3);
  requireTextArray(result.recommendation?.changeExplanation, "operationResult.recommendation.changeExplanation");
  requireTextArray(result.selectionReasons, "operationResult.selectionReasons", 3);
  requireTextArray(result.evidence, "operationResult.evidence");
  if (!Array.isArray(result.recommendation?.internalLinks) || result.recommendation.internalLinks.length === 0) throw new Error("operationResult.recommendation.internalLinks must contain at least one link.");
}

function normalizeTextList(value) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return String(item ?? "");
    const heading = item.question ?? item.source ?? "Evidence";
    const detail = item.answer ?? (Array.isArray(item.supports) ? item.supports.join("; ") : item.url ?? "");
    return `${heading}: ${detail}`.trim();
  }).filter(Boolean);
}

function normalizeCommercialIntent(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  return "low";
}

function normalizeOperationResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  return {
    ...result,
    opportunities: Array.isArray(result.opportunities)
      ? result.opportunities.map((opportunity) => ({
        ...opportunity,
        commercialIntent: normalizeCommercialIntent(opportunity.commercialIntent),
        evidence: normalizeTextList(opportunity.evidence),
      }))
      : result.opportunities,
    recommendation: result.recommendation ? {
      ...result.recommendation,
      faqs: normalizeTextList(result.recommendation.faqs),
      changeExplanation: normalizeTextList(result.recommendation.changeExplanation),
    } : result.recommendation,
    qualityReview: result.qualityReview ? {
      ...result.qualityReview,
      claimsVerified: Array.isArray(result.qualityReview.claimsVerified)
        ? result.qualityReview.claimsVerified.join(" ")
        : result.qualityReview.claimsVerified,
    } : result.qualityReview,
    evidence: normalizeTextList(result.evidence),
  };
}

function validatePackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Agent output package must be an object.");
  }
  value = { ...value, operationResult: normalizeOperationResult(value.operationResult) };
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
  validateOperationResult(value.operationResult);
  return value;
}

function extractJsonCandidate(output) {
  const fenced = output.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  return fenced ?? output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
}

export function extractHermesSessionId(output) {
  return typeof output === "string"
    ? output.match(/session_id:\s*([a-zA-Z0-9_-]+)/)?.[1] ?? null
    : null;
}

export function outputNeedsResume(output) {
  if (typeof output !== "string") return false;
  try {
    const value = JSON.parse(extractJsonCandidate(output));
    return value?.runState?.status === "IN_PROGRESS" ||
      typeof value?.final !== "string" || !value.final.trim() ||
      value?.qualityReview?.finalVerdict === "PENDING";
  } catch {
    return false;
  }
}

export function parseAgentPackage(output) {
  if (typeof output !== "string" || output.length > 1024 * 1024) {
    throw new Error("Agent output is missing or exceeds the 1 MB limit.");
  }
  const candidate = extractJsonCandidate(output);
  if (!candidate) throw new Error("Agent output did not contain a JSON package.");
  try {
    return validatePackage(JSON.parse(candidate));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Agent output package is not valid JSON.");
    throw error;
  }
}

export async function parseAgentPackageWithRetry(output, repair) {
  try {
    return parseAgentPackage(output);
  } catch (firstError) {
    if (typeof repair !== "function") throw firstError;
    return parseAgentPackage(await repair(firstError));
  }
}

export async function writeAgentPackage(runDirectory, packageValue) {
  const validated = validatePackage(packageValue);
  await Promise.all(PACKAGE_FIELDS.map(async (field) => {
    const value = field === "backlog" || field === "runState" || field === "operationResult"
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
