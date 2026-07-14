const REVIEW_FIELDS = [
  "rejectedText",
  "rejectionReason",
  "requiredRevision",
  "revisedText",
  "claimsVerified",
  "searchIntent",
  "businessRelevance",
  "brandFit",
  "finalQualityScore",
  "finalVerdict",
];

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Independent review field ${field} must be non-empty text.`);
  }
}

export function parseIndependentReview(output) {
  if (typeof output !== "string" || output.length > 128 * 1024) {
    throw new Error("Independent review is missing or exceeds 128 KB.");
  }
  const fenced = output.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced ?? output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
  let value;
  try {
    value = JSON.parse(candidate);
  } catch {
    throw new Error("Independent review is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Independent review must be an object.");
  }
  const unexpected = Object.keys(value).filter((key) => !REVIEW_FIELDS.includes(key));
  if (unexpected.length) throw new Error(`Independent review contains unexpected fields: ${unexpected.join(", ")}.`);
  for (const field of REVIEW_FIELDS) {
    if (!(field in value)) throw new Error(`Independent review is missing ${field}.`);
  }
  for (const field of REVIEW_FIELDS.filter((field) => !["finalQualityScore"].includes(field))) {
    requireText(value[field], field);
  }
  if (value.finalVerdict !== "PASS") throw new Error("Independent review finalVerdict must be PASS.");
  if (!Number.isFinite(value.finalQualityScore) || value.finalQualityScore < 0 || value.finalQualityScore > 100) {
    throw new Error("Independent review finalQualityScore must be from 0 to 100.");
  }
  return value;
}

function replaceText(value, rejectedText, revisedText, counter) {
  if (typeof value === "string") {
    if (!value.includes(rejectedText)) return value;
    counter.count += value.split(rejectedText).length - 1;
    return value.split(rejectedText).join(revisedText);
  }
  if (Array.isArray(value)) return value.map((item) => replaceText(item, rejectedText, revisedText, counter));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      replaceText(item, rejectedText, revisedText, counter),
    ]));
  }
  return value;
}

export function applyIndependentReview(candidatePackage, rawReview) {
  const review = parseIndependentReview(JSON.stringify(rawReview));
  const counter = { count: 0 };
  const revised = replaceText(candidatePackage, review.rejectedText, review.revisedText, counter);
  if (counter.count === 0) {
    throw new Error("Independent review rejectedText was not found in the candidate package.");
  }
  const qualityReview = [
    "## Independent quality review",
    "",
    "Initial verdict: REJECT",
    `Rejected text: ${review.rejectedText}`,
    `Reason: ${review.rejectionReason}`,
    `Required revision: ${review.requiredRevision}`,
    "",
    "## Revision completed",
    `Original: ${review.rejectedText}`,
    `Revised: ${review.revisedText}`,
    "",
    `Claims verified: ${review.claimsVerified}`,
    `Search intent: ${review.searchIntent}`,
    `Business relevance: ${review.businessRelevance}`,
    `Brand fit: ${review.brandFit}`,
    "Revision count: 1",
    `Final quality score: ${review.finalQualityScore}/100`,
    "Verdict: PASS",
  ].join("\n");
  revised.qualityReview = qualityReview;
  revised.runState = { ...revised.runState, status: "AWAITING_COPY_APPROVAL" };
  revised.runSummary = `${revised.runSummary.trim()}\n\nIndependent quality review passed after one bounded revision.`;
  revised.operationResult = {
    ...revised.operationResult,
    qualityReview: {
      initialVerdict: "REJECT",
      rejectedText: review.rejectedText,
      rejectionReason: review.rejectionReason,
      requiredRevision: review.requiredRevision,
      revision: { original: review.rejectedText, revised: review.revisedText },
      finalVerdict: "PASS",
      claimsVerified: review.claimsVerified,
      searchIntent: review.searchIntent,
      businessRelevance: review.businessRelevance,
      brandFit: review.brandFit,
      revisionCount: 1,
      finalQualityScore: review.finalQualityScore,
    },
  };
  return revised;
}
