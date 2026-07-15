import { evaluateBrief } from "../../../lib/brief";
import { startHermesRun } from "../../../lib/hermes-runner";
import { GROWTH_OBJECTIVES, type GrowthObjective } from "../../../lib/kairo-operation";
import { createWebsiteUnderstanding } from "../../../lib/seo/dashboard-audit";
import { collectWebsiteEvidence } from "../../../lib/seo/evidence";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 10_000;

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.KAIRO_API_KEY;
  if (apiKey && request.headers.get("x-kairo-key") !== apiKey) {
    return json({ error: "A valid operation key is required." }, 401);
  }

  const live = process.env.VERCEL
    ? String(process.env.KAIRO_LIVE ?? "").startsWith("1")
    : String(process.env.KAIRO_LIVE ?? "") !== "0";
  if (!live) {
    return json(
      { error: "Live operations require a secure Kairo operation worker and are not available on this hosted preview." },
      503,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }
    raw = JSON.parse(text);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!raw || typeof raw !== "object") {
    return json({ error: "Request body must be an object." }, 400);
  }

  const input = raw as Record<string, unknown>;
  if (typeof input.url !== "string") {
    return json({ error: "A public website URL is required." }, 400);
  }
  if (typeof input.objective !== "string" ||
      !GROWTH_OBJECTIVES.includes(input.objective as GrowthObjective)) {
    return json({ error: "A supported growth objective is required." }, 400);
  }
  if (input.targetMarket !== undefined &&
      (typeof input.targetMarket !== "string" || input.targetMarket.trim().length > 120)) {
    return json({ error: "Target market must be 120 characters or fewer." }, 400);
  }
  const objective = input.objective as GrowthObjective;
  const targetMarket = typeof input.targetMarket === "string"
    ? input.targetMarket.trim() || "Not specified"
    : "Not specified";

  const brief = evaluateBrief({
    url: input.url,
    objective,
    pageType: "unknown",
  });
  if (!brief.ok) {
    return json({ error: "Invalid audit brief.", details: brief.errors }, 400);
  }

  try {
    const evidence = await collectWebsiteEvidence(brief.normalizedUrl);
    const audit = createWebsiteUnderstanding(evidence, objective);
    const run = await startHermesRun({
      url: brief.normalizedUrl,
      objective,
      targetMarket,
      pageType: "unknown",
    }, evidence);
    const publicEvidence = {
      ...evidence,
      robots: evidence.robots ? { ...evidence.robots, content: undefined } : null,
      sitemap: evidence.sitemap ? { ...evidence.sitemap, content: undefined } : null,
    };
    return json({ brief, audit, evidence: publicEvidence, run }, 202);
  } catch {
    return json(
      {
        error: "The website could not be inspected safely. Confirm that it is public and try again.",
      },
      422,
    );
  }
}
