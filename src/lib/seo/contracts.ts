export type SeoCategory = "technical" | "content" | "authority" | "conversion";

export type EvidenceRecord = {
  id: string;
  sourceUrl: string;
  retrievedAt: string;
  claim: string;
  value: unknown;
};

export type SeoOpportunity = {
  id: string;
  title: string;
  category: SeoCategory;
  impact: 1 | 2 | 3 | 4 | 5;
  confidence: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  executable: boolean;
  evidenceIds: string[];
  rationale: string;
};

export type RankedSeoOpportunity = SeoOpportunity & {
  score: number;
  reasons: string[];
};
