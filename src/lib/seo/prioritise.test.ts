import { describe, expect, it } from "vitest";
import { prioritiseOpportunities } from "./prioritise";
import type { SeoOpportunity } from "./contracts";

describe("prioritiseOpportunities", () => {
  it("prioritises a conversion-relevant commercial-page gap over cosmetic work", () => {
    const opportunities: SeoOpportunity[] = [
      {
        id: "title-intent-gap",
        title: "Align the title and H1 with consultation intent",
        category: "content",
        impact: 5,
        confidence: 5,
        effort: 2,
        executable: true,
        evidenceIds: ["page-title", "page-h1", "commercial-objective"],
        rationale: "The current title and H1 do not describe the service or target conversion.",
      },
      {
        id: "favicon-refresh",
        title: "Refresh the favicon",
        category: "technical",
        impact: 1,
        confidence: 3,
        effort: 1,
        executable: true,
        evidenceIds: ["favicon"],
        rationale: "The favicon is visually dated.",
      },
    ];

    const ranked = prioritiseOpportunities(opportunities);

    expect(ranked[0]).toMatchObject({ id: "title-intent-gap", score: 12.5 });
    expect(ranked[0].reasons).toContain("High expected commercial impact");
    expect(ranked[1].id).toBe("favicon-refresh");
  });

  it("places non-executable opportunities after actions Hermes can complete", () => {
    const ranked = prioritiseOpportunities([
      {
        id: "authority-campaign",
        title: "Run a six-month digital PR campaign",
        category: "authority",
        impact: 5,
        confidence: 3,
        effort: 5,
        executable: false,
        evidenceIds: ["competitor-links"],
        rationale: "Competitors have stronger authority.",
      },
      {
        id: "meta-rewrite",
        title: "Rewrite metadata",
        category: "content",
        impact: 3,
        confidence: 4,
        effort: 1,
        executable: true,
        evidenceIds: ["page-title"],
        rationale: "The metadata is generic.",
      },
    ]);

    expect(ranked.map(({ id }) => id)).toEqual(["meta-rewrite", "authority-campaign"]);
  });
});
