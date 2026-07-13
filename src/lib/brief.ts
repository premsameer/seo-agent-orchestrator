export const PAGE_TYPES = ["commercial", "editorial", "homepage", "unknown"] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export type BriefInput = {
  url: string;
  objective: string;
  pageType: PageType;
};

type BriefSuccess = {
  ok: true;
  normalizedUrl: string;
  score: number;
  missingContext: string[];
  recommendedAction: string;
};

type BriefFailure = {
  ok: false;
  errors: string[];
};

export type BriefResult = BriefSuccess | BriefFailure;

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

function isUnsafeHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0:0:0:0:0:0:0:1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true;
  }

  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(host));
}

function parsePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      isUnsafeHostname(url.hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function recommendationFor(pageType: PageType): string {
  switch (pageType) {
    case "commercial":
      return "Audit the commercial page against search intent, conversion clarity, and competitor evidence.";
    case "homepage":
      return "Audit the homepage positioning, entity signals, and paths to priority commercial pages.";
    case "editorial":
      return "Validate the editorial page against search intent, evidence quality, and internal-link opportunities.";
    default:
      return "Classify the target page and confirm the highest-value conversion before starting the audit.";
  }
}

export function evaluateBrief(input: BriefInput): BriefResult {
  const errors: string[] = [];
  const url = parsePublicUrl(input.url);
  const objective = input.objective.trim();

  if (!url) {
    errors.push("Provide a public HTTP or HTTPS URL without credentials or a private-network hostname.");
  }
  if (objective.length === 0 || objective.length > 500) {
    errors.push("Provide a commercial objective between 1 and 500 characters.");
  }
  if (!PAGE_TYPES.includes(input.pageType)) {
    errors.push("Choose a supported page type.");
  }

  if (errors.length > 0 || !url) {
    return { ok: false, errors };
  }

  const missingContext: string[] = [];
  let score = 40;

  if (objective.length >= 30) {
    score += 25;
  } else {
    missingContext.push("Describe the desired business outcome, audience, and conversion in one sentence.");
  }

  if (/lead|revenue|sale|signup|consult|book|demo|trial|application|enrol|purchase/i.test(objective)) {
    score += 20;
  } else {
    missingContext.push("Name the measurable conversion or revenue outcome, not only a traffic goal.");
  }

  if (input.pageType !== "unknown") {
    score += 15;
  } else {
    missingContext.push("Identify whether the target is a homepage, commercial page, or editorial page.");
  }

  return {
    ok: true,
    normalizedUrl: url.toString(),
    score: Math.min(score, 100),
    missingContext,
    recommendedAction: recommendationFor(input.pageType),
  };
}
