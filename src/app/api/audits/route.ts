import { evaluateBrief } from "../../../lib/brief";
import { startHermesRun } from "../../../lib/hermes-runner";
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

const DEFAULT_OBJECTIVE =
  "Find and prioritize organic search improvements that can increase qualified conversions for this website.";

export async function POST(request: Request): Promise<Response> {
  if (process.env.VERCEL) {
    return json(
      { error: "Live SEO agent runs require the local Hermes runtime and are disabled on this hosted deployment." },
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

  const brief = evaluateBrief({
    url: input.url,
    objective: DEFAULT_OBJECTIVE,
    pageType: "unknown",
  });
  if (!brief.ok) {
    return json({ error: "Invalid audit brief.", details: brief.errors }, 400);
  }

  try {
    const evidence = await collectWebsiteEvidence(brief.normalizedUrl);
    const audit = createWebsiteUnderstanding(evidence, DEFAULT_OBJECTIVE);
    const run = await startHermesRun({
      url: brief.normalizedUrl,
      objective: DEFAULT_OBJECTIVE,
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
