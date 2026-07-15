const REVIEW_FIELDS = [
  "verdict",
  "rejectedText",
  "rejectionReason",
  "requiredRevision",
  "revisedText",
  "claimsVerified",
  "searchIntent",
  "businessRelevance",
  "brandFit",
  "finalQualityScore",
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
  for (const field of ["claimsVerified", "searchIntent", "businessRelevance", "brandFit"]) {
    requireText(value[field], field);
  }
  if (!["PASS", "REJECT"].includes(value.verdict)) {
    throw new Error("Independent review verdict must be PASS or REJECT.");
  }
  if (value.verdict === "REJECT") {
    for (const field of ["rejectedText", "rejectionReason", "requiredRevision", "revisedText"]) {
      requireText(value[field], field);
    }
  } else if (["rejectedText", "rejectionReason", "requiredRevision", "revisedText"].some((field) => value[field] !== "")) {
    throw new Error("A passing independent review must not include a proposed revision.");
  }
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

export function applyProposedRevision(candidatePackage, rawReview) {
  const review = parseIndependentReview(JSON.stringify(rawReview));
  if (review.verdict !== "REJECT") {
    throw new Error("Only a rejected review can propose a revision.");
  }
  const counter = { count: 0 };
  const revised = replaceText(candidatePackage, review.rejectedText, review.revisedText, counter);
  if (counter.count === 0) {
    throw new Error("Independent review rejectedText was not found in the candidate package.");
  }
  return revised;
}

export function applyIndependentReview(candidatePackage, rawReview, rawFinalReview) {
  const review = parseIndependentReview(JSON.stringify(rawReview));
  const revised = review.verdict === "REJECT"
    ? applyProposedRevision(candidatePackage, review)
    : structuredClone(candidatePackage);
  const finalReview = rawFinalReview
    ? parseIndependentReview(JSON.stringify(rawFinalReview))
    : review;
  if (finalReview.verdict !== "PASS") {
    throw new Error("The revised candidate did not pass final verification.");
  }
  const revisionCount = review.verdict === "REJECT" ? 1 : 0;
  const qualityReview = [
    "## Independent quality review",
    "",
    `Initial verdict: ${review.verdict}`,
    ...(revisionCount === 1 ? [
      `Rejected text: ${review.rejectedText}`,
      `Reason: ${review.rejectionReason}`,
      `Required revision: ${review.requiredRevision}`,
      "",
      "## Revision completed",
      `Original: ${review.rejectedText}`,
      `Revised: ${review.revisedText}`,
    ] : ["No revision required."]),
    "",
    `Claims verified: ${finalReview.claimsVerified}`,
    `Search intent: ${finalReview.searchIntent}`,
    `Business relevance: ${finalReview.businessRelevance}`,
    `Brand fit: ${finalReview.brandFit}`,
    `Revision count: ${revisionCount}`,
    `Final quality score: ${finalReview.finalQualityScore}/100`,
    "Verdict: PASS",
  ].join("\n");
  revised.qualityReview = qualityReview;
  revised.runState = { ...revised.runState, status: "AWAITING_COPY_APPROVAL" };
  revised.runSummary = `${revised.runSummary.trim()}\n\nIndependent quality review passed${revisionCount === 1 ? " after one bounded revision" : " without requiring a revision"}.`;
  revised.operationResult = {
    ...revised.operationResult,
    qualityReview: {
      initialVerdict: review.verdict,
      rejectedText: revisionCount === 1 ? review.rejectedText : "",
      rejectionReason: revisionCount === 1 ? review.rejectionReason : "",
      requiredRevision: revisionCount === 1 ? review.requiredRevision : "",
      revision: {
        original: revisionCount === 1 ? review.rejectedText : "",
        revised: revisionCount === 1 ? review.revisedText : "",
      },
      finalVerdict: "PASS",
      claimsVerified: finalReview.claimsVerified,
      searchIntent: finalReview.searchIntent,
      businessRelevance: finalReview.businessRelevance,
      brandFit: finalReview.brandFit,
      revisionCount,
      finalQualityScore: finalReview.finalQualityScore,
    },
  };
  return revised;
}
