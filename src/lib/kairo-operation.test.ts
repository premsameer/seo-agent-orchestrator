import { describe, expect, it } from "vitest";
import {
  KAIRO_SAMPLE_OPERATION,
  priorityScore,
  validateKairoOperationResult,
} from "./kairo-operation";

describe("Kairo operation result", () => {
  it("contains exactly three transparently scored opportunities and one selection", () => {
    const result = validateKairoOperationResult(KAIRO_SAMPLE_OPERATION);

    expect(result.opportunities).toHaveLength(3);
    expect(result.opportunities.filter((opportunity) => opportunity.selected)).toHaveLength(1);
    for (const opportunity of result.opportunities) {
      expect(opportunity.priorityScore).toBe(
        priorityScore(opportunity.impact, opportunity.confidence, opportunity.effort),
      );
    }
    expect(result.selectedOpportunityId).toBe(
      result.opportunities.find((opportunity) => opportunity.selected)?.id,
    );
  });

  it("contains one commercial-page improvement and one bounded QC revision", () => {
    const result = validateKairoOperationResult(KAIRO_SAMPLE_OPERATION);

    expect(result.recommendation.type).toBe("commercial-page-improvement");
    expect(result.recommendation.pageStructure.length).toBeGreaterThanOrEqual(4);
    expect(result.recommendation.faqs.length).toBeGreaterThanOrEqual(3);
    expect(result.qualityReview.initialVerdict).toBe("REJECT");
    expect(result.qualityReview.finalVerdict).toBe("PASS");
    expect(result.qualityReview.revisionCount).toBe(1);
    expect(result.qualityReview.revision.revised).not.toBe(
      result.qualityReview.revision.original,
    );
  });

  it("accepts a clean independent review without inventing a revision", () => {
    const result = validateKairoOperationResult({
      ...KAIRO_SAMPLE_OPERATION,
      qualityReview: {
        ...KAIRO_SAMPLE_OPERATION.qualityReview,
        initialVerdict: "PASS",
        rejectedText: "",
        rejectionReason: "",
        requiredRevision: "",
        revision: { original: "", revised: "" },
        revisionCount: 0,
      },
    });

    expect(result.qualityReview.revisionCount).toBe(0);
  });

  it("rejects malformed opportunity sets and score manipulation", () => {
    expect(() => validateKairoOperationResult({
      ...KAIRO_SAMPLE_OPERATION,
      opportunities: KAIRO_SAMPLE_OPERATION.opportunities.slice(0, 2),
    })).toThrow("exactly three opportunities");

    expect(() => validateKairoOperationResult({
      ...KAIRO_SAMPLE_OPERATION,
      opportunities: KAIRO_SAMPLE_OPERATION.opportunities.map((opportunity, index) =>
        index === 0 ? { ...opportunity, priorityScore: 999 } : opportunity
      ),
    })).toThrow("priority score");
  });

  it("rejects incomplete deliverables before they reach the interface", () => {
    expect(() => validateKairoOperationResult({
      ...KAIRO_SAMPLE_OPERATION,
      recommendation: { ...KAIRO_SAMPLE_OPERATION.recommendation, faqs: undefined },
    })).toThrow("recommendation.faqs");
  });
});
