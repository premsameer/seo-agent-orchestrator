import type { RankedSeoOpportunity, SeoOpportunity } from "./contracts";

function scoreOpportunity(opportunity: SeoOpportunity): number {
  return Number(((opportunity.impact * opportunity.confidence) / opportunity.effort).toFixed(2));
}

function explain(opportunity: SeoOpportunity): string[] {
  const reasons: string[] = [];

  if (opportunity.impact >= 4) {
    reasons.push("High expected commercial impact");
  }
  if (opportunity.confidence >= 4) {
    reasons.push("Strong supporting evidence");
  }
  if (opportunity.effort <= 2) {
    reasons.push("Low implementation effort");
  }
  if (!opportunity.executable) {
    reasons.push("Requires work outside the approved autonomous scope");
  }

  return reasons;
}

export function prioritiseOpportunities(
  opportunities: SeoOpportunity[],
): RankedSeoOpportunity[] {
  return opportunities
    .map((opportunity) => ({
      ...opportunity,
      score: scoreOpportunity(opportunity),
      reasons: explain(opportunity),
    }))
    .sort((left, right) => {
      if (left.executable !== right.executable) {
        return left.executable ? -1 : 1;
      }
      return right.score - left.score || left.id.localeCompare(right.id);
    });
}
