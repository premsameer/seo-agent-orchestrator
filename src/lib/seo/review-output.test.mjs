import { describe, expect, it } from "vitest";
import { applyIndependentReview, parseIndependentReview } from "../../../scripts/kairo-review.mjs";
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
  rejectedText: "Become compliant in weeks, not months.",
  rejectionReason: "No verified timeline supports this claim.",
  requiredRevision: "Remove the timing promise.",
  revisedText: "Move from scattered evidence to an audit-ready process.",
  claimsVerified: "Remaining claims map to first-party evidence.",
  searchIntent: "Aligned with commercial readiness intent.",
  businessRelevance: "Supports qualified assessment demand.",
  brandFit: "Direct and credible.",
  finalQualityScore: 94,
  finalVerdict: "PASS",
};

describe("independent quality review", () => {
  it("parses a compact fenced review response", () => {
    expect(parseIndependentReview(`\`\`\`json\n${JSON.stringify(review)}\n\`\`\``)).toEqual(review);
  });

  it("applies one bounded revision to the full candidate package", () => {
    const result = applyIndependentReview(candidate, review);

    expect(result.final).toContain(review.revisedText);
    expect(result.final).not.toContain(review.rejectedText);
    expect(result.operationResult.recommendation.heroHeadline).toBe(review.revisedText);
    expect(result.operationResult.qualityReview.finalVerdict).toBe("PASS");
    expect(result.operationResult.qualityReview.revisionCount).toBe(1);
    expect(result.qualityReview).toContain("Verdict: PASS");
  });

  it("rejects a review that does not target candidate text", () => {
    expect(() => applyIndependentReview(candidate, {
      ...review,
      rejectedText: "Text that is not in the candidate.",
    })).toThrow("not found in the candidate");
  });
});
