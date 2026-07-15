import { describe, expect, it } from "vitest";
import { applyIndependentReview, applyProposedRevision, parseIndependentReview } from "../../../scripts/kairo-review.mjs";
import { KAIRO_SAMPLE_OPERATION } from "../kairo-operation";

const candidate = {
  marketEvidence: "Evidence packet",
  backlog: KAIRO_SAMPLE_OPERATION.opportunities,
  draft: "Draft claim: Become compliant in weeks, not months.",
  qualityReview: "Candidate self-check",
  final: "Final claim: Become compliant in weeks, not months.",
  runState: { status: "AWAITING_COPY_APPROVAL" },
  runSummary: "Candidate summary",
  operationResult: {
    ...KAIRO_SAMPLE_OPERATION,
    recommendation: {
      ...KAIRO_SAMPLE_OPERATION.recommendation,
      heroHeadline: "Become compliant in weeks, not months.",
    },
  },
};

const review = {
  verdict: "REJECT",
  rejectedText: "Become compliant in weeks, not months.",
  rejectionReason: "No verified timeline supports this claim.",
  requiredRevision: "Remove the timing promise.",
  revisedText: "Move from scattered evidence to an audit-ready process.",
  claimsVerified: "Remaining claims map to first-party evidence.",
  searchIntent: "Aligned with commercial readiness intent.",
  businessRelevance: "Supports qualified assessment demand.",
  brandFit: "Direct and credible.",
  finalQualityScore: 94,
};

const approval = {
  verdict: "PASS",
  rejectedText: "",
  rejectionReason: "",
  requiredRevision: "",
  revisedText: "",
  claimsVerified: "Revised claims map to first-party evidence.",
  searchIntent: "Aligned with commercial readiness intent.",
  businessRelevance: "Supports qualified assessment demand.",
  brandFit: "Direct and credible.",
  finalQualityScore: 96,
};

describe("independent quality review", () => {
  it("parses a compact fenced review response", () => {
    expect(parseIndependentReview(`\`\`\`json\n${JSON.stringify(review)}\n\`\`\``)).toEqual(review);
  });

  it("applies one bounded revision only after a second review passes", () => {
    const revisedCandidate = applyProposedRevision(candidate, review);
    expect(revisedCandidate.final).toContain(review.revisedText);

    const result = applyIndependentReview(candidate, review, approval);

    expect(result.final).toContain(review.revisedText);
    expect(result.final).not.toContain(review.rejectedText);
    expect(result.operationResult.recommendation.heroHeadline).toBe(review.revisedText);
    expect(result.operationResult.qualityReview.finalVerdict).toBe("PASS");
    expect(result.operationResult.qualityReview.revisionCount).toBe(1);
    expect(result.qualityReview).toContain("Verdict: PASS");
  });

  it("allows an independently clean candidate to pass without a fake rejection", () => {
    const result = applyIndependentReview(candidate, approval);

    expect(result.final).toBe(candidate.final);
    expect(result.operationResult.qualityReview.initialVerdict).toBe("PASS");
    expect(result.operationResult.qualityReview.revisionCount).toBe(0);
    expect(result.qualityReview).toContain("No revision required");
  });

  it("fails closed when the revised candidate does not pass re-review", () => {
    expect(() => applyIndependentReview(candidate, review, {
      ...approval,
      verdict: "REJECT",
      rejectedText: review.revisedText,
      rejectionReason: "A blocking issue remains.",
      requiredRevision: "A second revision would be required.",
      revisedText: "Another revision",
    })).toThrow("did not pass final verification");
  });

  it("rejects a review that does not target candidate text", () => {
    expect(() => applyProposedRevision(candidate, {
      ...review,
      rejectedText: "Text that is not in the candidate.",
    })).toThrow("not found in the candidate");
  });
});
