import type { WebsiteEvidenceReport } from "./evidence";

export type DashboardStageStatus = "complete" | "preliminary" | "requires_research";

export type DashboardAudit = {
  business: {
    host: string;
    title: string | null;
    description: string | null;
    primaryHeading: string | null;
    wordCount: number;
    indexable: boolean;
  };
  findings: string[];
  keywordSeeds: string[];
  clusters: Array<{
    name: string;
    evidenceBasis: "first-party" | "user-objective";
    themes: string[];
  }>;
  stages: {
    websiteUnderstanding: { status: DashboardStageStatus; detail: string };
    marketResearch: { status: DashboardStageStatus; detail: string };
    keywordStrategy: { status: DashboardStageStatus; detail: string };
    copyGeneration: { status: DashboardStageStatus; detail: string };
  };
};

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length >= 3))];
}

function firstPartySeeds(report: WebsiteEvidenceReport): string[] {
  const headings = [...report.page.h1, ...report.page.h2].map(normalizePhrase);
  const focused = headings.flatMap((heading) => {
    const beforeQualifier = heading.split(/\b(?:for|by|with)\b/)[0]?.trim();
    return beforeQualifier && beforeQualifier !== heading
      ? [beforeQualifier, heading]
      : [heading];
  });

  return unique(focused).slice(0, 12);
}

export function createWebsiteUnderstanding(
  report: WebsiteEvidenceReport,
  objective: string,
): DashboardAudit {
  const host = new URL(report.targetUrl).hostname;
  const findings: string[] = [];
  const primaryHeading = report.page.h1[0] ?? null;
  const indexable = !report.page.robotsDirective?.toLowerCase().includes("noindex");

  if (!primaryHeading) findings.push("No H1 was present in the fetched HTML.");
  if (!report.page.metaDescription) findings.push("No meta description was present.");
  if (!report.page.canonicalUrl) findings.push("No canonical URL was present.");
  if (!report.sitemap) findings.push("No accessible XML sitemap was confirmed.");
  if (report.page.wordCount < 100) {
    findings.push("The fetched HTML contained very little readable body content.");
  }
  findings.push(...report.errors);

  const keywordSeeds = firstPartySeeds(report);
  const objectiveTheme = normalizePhrase(objective)
    .replace(/\b(?:increase|improve|more|from|qualified)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    business: {
      host,
      title: report.page.title,
      description: report.page.metaDescription,
      primaryHeading,
      wordCount: report.page.wordCount,
      indexable,
    },
    findings: unique(findings),
    keywordSeeds,
    clusters: [
      {
        name: "Commercial offer",
        evidenceBasis: "first-party",
        themes: keywordSeeds.slice(0, 4),
      },
      {
        name: "Problems and education",
        evidenceBasis: "first-party",
        themes: unique(report.page.h2.map(normalizePhrase)).slice(0, 4),
      },
      {
        name: "Conversion objective",
        evidenceBasis: "user-objective",
        themes: objectiveTheme ? [objectiveTheme] : [],
      },
    ],
    stages: {
      websiteUnderstanding: {
        status: report.errors.length === 0 ? "complete" : "preliminary",
        detail:
          report.errors.length === 0
            ? "Collected bounded first-party page, robots, and sitemap evidence."
            : "The primary page was collected, but supporting evidence is partial; review the reported failures.",
      },
      marketResearch: {
        status: "requires_research",
        detail: "Kairo will research and cite relevant market and competitor pages.",
      },
      keywordStrategy: {
        status: "preliminary",
        detail: "Seeds come only from first-party headings; no volume or ranking claims are inferred.",
      },
      copyGeneration: {
        status: "requires_research",
        detail: "Copy is generated only after market evidence and an independent QC pass.",
      },
    },
  };
}
