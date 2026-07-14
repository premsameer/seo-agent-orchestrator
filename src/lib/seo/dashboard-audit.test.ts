import { describe, expect, it } from "vitest";
import { createWebsiteUnderstanding } from "./dashboard-audit";
import type { WebsiteEvidenceReport } from "./evidence";

const evidence: WebsiteEvidenceReport = {
  targetUrl: "https://example.com/services/growth",
  collectedAt: "2026-07-12T08:00:03.000Z",
  pageResource: {
    sourceUrl: "https://example.com/services/growth",
    retrievedAt: "2026-07-12T08:00:00.000Z",
    status: 200,
  },
  page: {
    sourceUrl: "https://example.com/services/growth",
    retrievedAt: "2026-07-12T08:00:00.000Z",
    title: "Growth Systems for B2B Startups | Example",
    metaDescription: "Design go-to-market systems for sustainable growth.",
    canonicalUrl: null,
    robotsDirective: "index,follow",
    h1: ["Growth Systems for B2B Startups"],
    h2: ["Go-to-market strategy", "Fix fragmented growth teams"],
    internalLinks: ["https://example.com/contact"],
    externalLinks: [],
    hasJsonLd: false,
    wordCount: 420,
  },
  robots: null,
  sitemap: null,
  errors: ["sitemap: HTTP 404"],
};

describe("createWebsiteUnderstanding", () => {
  it("turns live first-party evidence into transparent preliminary themes", () => {
    const result = createWebsiteUnderstanding(
      evidence,
      "Increase qualified consultation applications from B2B startup founders.",
    );

    expect(result.business.host).toBe("example.com");
    expect(result.business.primaryHeading).toBe("Growth Systems for B2B Startups");
    expect(result.keywordSeeds).toContain("growth systems");
    expect(result.keywordSeeds).toContain("go to market strategy");
    expect(result.clusters[0]).toMatchObject({
      name: "Commercial offer",
      evidenceBasis: "first-party",
    });
    expect(result.clusters[2]).toMatchObject({
      name: "Conversion objective",
      evidenceBasis: "user-objective",
    });
    expect(result.stages.marketResearch.status).toBe("requires_research");
    expect(result.stages.copyGeneration.status).toBe("requires_research");
  });

  it("does not invent a heading when the page has no rendered H1", () => {
    const result = createWebsiteUnderstanding(
      { ...evidence, page: { ...evidence.page, h1: [] } },
      "Increase qualified consultation applications.",
    );

    expect(result.business.primaryHeading).toBeNull();
    expect(result.findings).toContain("No H1 was present in the fetched HTML.");
  });

  it("marks website understanding partial when supporting resources fail", () => {
    const result = createWebsiteUnderstanding(evidence, "Increase qualified applications.");

    expect(result.stages.websiteUnderstanding.status).toBe("preliminary");
    expect(result.stages.websiteUnderstanding.detail).toContain("partial");
  });
});
