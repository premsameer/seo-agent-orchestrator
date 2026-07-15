export const GROWTH_OBJECTIVES = [
  "Generate more qualified leads",
  "Improve a commercial page",
  "Find a new high-intent page opportunity",
  "Improve local visibility",
  "Let Kairo decide",
] as const;

export type GrowthObjective = typeof GROWTH_OBJECTIVES[number];
export type Rating = 1 | 2 | 3 | 4 | 5;

export type KairoOpportunity = {
  id: string;
  title: string;
  page: string;
  impact: Rating;
  confidence: Rating;
  effort: Rating;
  commercialIntent: "high" | "medium" | "low";
  evidence: string[];
  explanation: string;
  priorityScore: number;
  selected: boolean;
};

export type KairoOperationResult = {
  sample: boolean;
  operationLabel: string;
  objective: GrowthObjective;
  targetMarket: string;
  business: {
    company: string;
    sells: string;
    targetCustomer: string;
    primaryConversion: string;
    targetMarket: string;
    commercialPages: string[];
  };
  opportunities: KairoOpportunity[];
  selectedOpportunityId: string;
  selectionReasons: string[];
  originalPage: {
    url: string;
    title: string;
    metaDescription: string;
    h1: string;
    heroCopy: string;
    structure: string[];
  };
  recommendation: {
    type: "commercial-page-improvement";
    title: string;
    metaDescription: string;
    h1: string;
    heroHeadline: string;
    heroCopy: string;
    primaryCta: string;
    pageStructure: string[];
    sectionsToImprove: string[];
    faqs: string[];
    internalLinks: Array<{ anchor: string; destination: string }>;
    changeExplanation: string[];
  };
  qualityReview: {
    initialVerdict: "PASS" | "REJECT";
    rejectedText: string;
    rejectionReason: string;
    requiredRevision: string;
    revision: { original: string; revised: string };
    finalVerdict: "PASS";
    claimsVerified: string;
    searchIntent: string;
    businessRelevance: string;
    brandFit: string;
    revisionCount: 0 | 1;
    finalQualityScore: number;
  };
  evidence: string[];
};

export function priorityScore(impact: number, confidence: number, effort: number): number {
  return Number(((impact * confidence) / effort).toFixed(2));
}

function assertText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty text.`);
}

function assertTextArray(value: unknown, field: string, minimum = 1): asserts value is string[] {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must contain at least ${minimum} non-empty text item${minimum === 1 ? "" : "s"}.`);
  }
}

export function validateKairoOperationResult(value: unknown): KairoOperationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Kairo operation result must be an object.");
  }
  const result = value as KairoOperationResult;
  if (typeof result.sample !== "boolean") throw new Error("sample must be a boolean.");
  assertText(result.operationLabel, "operationLabel");
  if (!GROWTH_OBJECTIVES.includes(result.objective)) throw new Error("objective is not supported.");
  assertText(result.targetMarket, "targetMarket");
  if (!Array.isArray(result.opportunities) || result.opportunities.length !== 3) {
    throw new Error("Kairo must return exactly three opportunities.");
  }
  const selected = result.opportunities.filter((opportunity) => opportunity.selected);
  if (selected.length !== 1 || selected[0]?.id !== result.selectedOpportunityId) {
    throw new Error("Kairo must select exactly one opportunity.");
  }
  for (const opportunity of result.opportunities) {
    assertText(opportunity.id, "opportunity.id");
    assertText(opportunity.title, `opportunity.${opportunity.id}.title`);
    assertText(opportunity.page, `opportunity.${opportunity.id}.page`);
    assertText(opportunity.explanation, `opportunity.${opportunity.id}.explanation`);
    if (!["high", "medium", "low"].includes(opportunity.commercialIntent)) {
      throw new Error(`opportunity.${opportunity.id}.commercialIntent is invalid.`);
    }
    for (const rating of [opportunity.impact, opportunity.confidence, opportunity.effort]) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error("Opportunity ratings must be integers from 1 to 5.");
      }
    }
    if (opportunity.priorityScore !== priorityScore(opportunity.impact, opportunity.confidence, opportunity.effort)) {
      throw new Error(`Opportunity ${opportunity.id} has an invalid priority score.`);
    }
    assertTextArray(opportunity.evidence, `opportunity.${opportunity.id}.evidence`);
  }
  if (result.recommendation?.type !== "commercial-page-improvement") {
    throw new Error("Kairo must return one commercial-page improvement.");
  }
  const review = result.qualityReview;
  const validReview = review?.finalVerdict === "PASS" && (
    (review.initialVerdict === "PASS" && review.revisionCount === 0) ||
    (review.initialVerdict === "REJECT" && review.revisionCount === 1)
  );
  if (!validReview) {
    throw new Error("Kairo quality review must pass directly or after one bounded revision.");
  }
  if (!Number.isFinite(result.qualityReview.finalQualityScore) ||
      result.qualityReview.finalQualityScore < 0 || result.qualityReview.finalQualityScore > 100) {
    throw new Error("Final quality score must be from 0 to 100.");
  }
  assertText(result.business?.company, "business.company");
  assertText(result.business?.sells, "business.sells");
  assertText(result.business?.targetCustomer, "business.targetCustomer");
  assertText(result.business?.primaryConversion, "business.primaryConversion");
  assertText(result.business?.targetMarket, "business.targetMarket");
  assertTextArray(result.business?.commercialPages, "business.commercialPages");
  assertText(result.originalPage?.url, "originalPage.url");
  assertText(result.originalPage?.title, "originalPage.title");
  assertText(result.originalPage?.metaDescription, "originalPage.metaDescription");
  assertText(result.originalPage?.h1, "originalPage.h1");
  assertText(result.originalPage?.heroCopy, "originalPage.heroCopy");
  assertTextArray(result.originalPage?.structure, "originalPage.structure");
  assertText(result.recommendation?.title, "recommendation.title");
  assertText(result.recommendation?.metaDescription, "recommendation.metaDescription");
  assertText(result.recommendation?.h1, "recommendation.h1");
  assertText(result.recommendation?.heroHeadline, "recommendation.heroHeadline");
  assertText(result.recommendation?.heroCopy, "recommendation.heroCopy");
  assertText(result.recommendation?.primaryCta, "recommendation.primaryCta");
  assertTextArray(result.recommendation?.pageStructure, "recommendation.pageStructure", 4);
  assertTextArray(result.recommendation?.sectionsToImprove, "recommendation.sectionsToImprove");
  assertTextArray(result.recommendation?.faqs, "recommendation.faqs", 3);
  assertTextArray(result.recommendation?.changeExplanation, "recommendation.changeExplanation");
  if (!Array.isArray(result.recommendation?.internalLinks) || result.recommendation.internalLinks.length === 0) {
    throw new Error("recommendation.internalLinks must contain at least one link.");
  }
  for (const [index, link] of result.recommendation.internalLinks.entries()) {
    assertText(link?.anchor, `recommendation.internalLinks.${index}.anchor`);
    assertText(link?.destination, `recommendation.internalLinks.${index}.destination`);
  }
  if (result.qualityReview.revisionCount === 1) {
    assertText(result.qualityReview.rejectedText, "qualityReview.rejectedText");
    assertText(result.qualityReview.rejectionReason, "qualityReview.rejectionReason");
    assertText(result.qualityReview.requiredRevision, "qualityReview.requiredRevision");
    assertText(result.qualityReview.revision?.original, "qualityReview.revision.original");
    assertText(result.qualityReview.revision?.revised, "qualityReview.revision.revised");
  }
  assertText(result.qualityReview?.claimsVerified, "qualityReview.claimsVerified");
  assertText(result.qualityReview?.searchIntent, "qualityReview.searchIntent");
  assertText(result.qualityReview?.businessRelevance, "qualityReview.businessRelevance");
  assertText(result.qualityReview?.brandFit, "qualityReview.brandFit");
  assertTextArray(result.selectionReasons, "selectionReasons", 3);
  assertTextArray(result.evidence, "evidence");
  return result;
}

export const KAIRO_SAMPLE_OPERATION: KairoOperationResult = {
  sample: true,
  operationLabel: "Sample operation · Northstar Compliance",
  objective: "Generate more qualified leads",
  targetMarket: "United States",
  business: {
    company: "Northstar Compliance",
    sells: "SOC 2 readiness software and expert compliance support",
    targetCustomer: "Security and operations leaders at growing B2B SaaS companies",
    primaryConversion: "Book a compliance readiness assessment",
    targetMarket: "United States",
    commercialPages: ["/", "/soc-2", "/pricing", "/book-assessment"],
  },
  opportunities: [
    {
      id: "soc2-page-positioning",
      title: "Strengthen the SOC 2 service page",
      page: "/soc-2",
      impact: 5,
      confidence: 5,
      effort: 2,
      commercialIntent: "high",
      evidence: ["The page targets SOC 2 but the title and H1 do not state the buyer or outcome.", "The assessment CTA appears only after the third section."],
      explanation: "The existing page already attracts decision-stage visitors, so clearer positioning and an earlier conversion path can improve qualified assessment demand.",
      priorityScore: 12.5,
      selected: true,
    },
    {
      id: "comparison-page",
      title: "Create a manual-vs-platform comparison page",
      page: "/soc-2-platform-vs-spreadsheets",
      impact: 4,
      confidence: 4,
      effort: 3,
      commercialIntent: "high",
      evidence: ["No comparison page addresses teams replacing spreadsheet-led readiness work."],
      explanation: "A comparison page could capture high-intent evaluators, but it requires a new page and proof review.",
      priorityScore: 5.33,
      selected: false,
    },
    {
      id: "internal-linking",
      title: "Connect educational guides to the SOC 2 page",
      page: "/resources/*",
      impact: 3,
      confidence: 4,
      effort: 2,
      commercialIntent: "medium",
      evidence: ["Six SOC 2 guides do not link to the primary commercial page."],
      explanation: "Contextual links can clarify the conversion path, but the likely commercial impact is lower than fixing the destination page itself.",
      priorityScore: 6,
      selected: false,
    },
  ],
  selectedOpportunityId: "soc2-page-positioning",
  selectionReasons: [
    "Directly supports the qualified-lead objective",
    "Strong decision-stage commercial intent",
    "Builds on an existing relevant page",
    "Low implementation effort",
    "Clear positioning and CTA gaps in first-party evidence",
  ],
  originalPage: {
    url: "https://northstar.example/soc-2",
    title: "SOC 2 | Northstar Compliance",
    metaDescription: "Get ready for SOC 2 with Northstar.",
    h1: "SOC 2 compliance, simplified",
    heroCopy: "Everything you need to get compliant and stay compliant.",
    structure: ["Hero", "Platform overview", "How it works", "CTA"],
  },
  recommendation: {
    type: "commercial-page-improvement",
    title: "SOC 2 Readiness for Growing SaaS Teams | Northstar",
    metaDescription: "Prepare for SOC 2 with guided readiness software, expert support, and a clear path from evidence collection to audit.",
    h1: "Get your SaaS company ready for SOC 2",
    heroHeadline: "Move from scattered evidence to an audit-ready SOC 2 process",
    heroCopy: "Northstar gives growing SaaS teams one guided workspace for SOC 2 readiness, with expert support when the process needs human judgment.",
    primaryCta: "Book a readiness assessment",
    pageStructure: ["Buyer problem and promise", "Readiness workflow", "What the platform supports", "Expert-support boundary", "Proof and trust", "FAQ", "Assessment CTA"],
    sectionsToImprove: ["Move the assessment CTA into the hero", "Replace generic platform copy with the verified readiness workflow", "Add buyer-fit and expert-support sections"],
    faqs: ["What does SOC 2 readiness include?", "How long should a SaaS team plan for readiness?", "Where does expert support fit?", "What happens before the audit begins?"],
    internalLinks: [
      { anchor: "SOC 2 evidence checklist", destination: "/resources/soc-2-evidence-checklist" },
      { anchor: "See Northstar pricing", destination: "/pricing" },
      { anchor: "Book a readiness assessment", destination: "/book-assessment" },
    ],
    changeExplanation: ["Names the SaaS buyer directly", "Aligns the hero with readiness intent", "Moves the verified conversion action above the fold", "Adds decision-stage detail without inventing outcomes"],
  },
  qualityReview: {
    initialVerdict: "REJECT",
    rejectedText: "Become SOC 2 compliant in weeks, not months.",
    rejectionReason: "The website provides no verified implementation timeline or guarantee.",
    requiredRevision: "Remove the timing promise and describe the supported readiness process instead.",
    revision: {
      original: "Become SOC 2 compliant in weeks, not months.",
      revised: "Move from scattered evidence to an audit-ready SOC 2 process.",
    },
    finalVerdict: "PASS",
    claimsVerified: "All commercial and process claims map to first-party page evidence.",
    searchIntent: "Matches decision-stage SOC 2 readiness intent.",
    businessRelevance: "Supports readiness-assessment demand from SaaS teams.",
    brandFit: "Direct, credible, and operational rather than promotional.",
    revisionCount: 1,
    finalQualityScore: 94,
  },
  evidence: [
    "Homepage and SOC 2 page retrieved for the sample on 12 July 2026.",
    "Primary CTA verified as a readiness assessment.",
    "No timeline guarantee or customer outcome metric was available.",
  ],
};
