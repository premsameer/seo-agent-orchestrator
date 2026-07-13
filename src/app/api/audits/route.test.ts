import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteEvidenceReport } from "../../../lib/seo/evidence";

const { collectWebsiteEvidenceMock, startHermesRunMock } = vi.hoisted(() => ({
  collectWebsiteEvidenceMock: vi.fn(),
  startHermesRunMock: vi.fn(),
}));

const report: WebsiteEvidenceReport = {
  targetUrl: "https://example.com/",
  collectedAt: "2026-07-12T08:00:03.000Z",
  pageResource: {
    sourceUrl: "https://example.com/",
    retrievedAt: "2026-07-12T08:00:00.000Z",
    status: 200,
  },
  page: {
    sourceUrl: "https://example.com/",
    retrievedAt: "2026-07-12T08:00:00.000Z",
    title: "Example Growth Systems",
    metaDescription: "Growth systems for startup teams.",
    canonicalUrl: "https://example.com/",
    robotsDirective: "index,follow",
    h1: ["Growth Systems"],
    h2: ["Go-to-market strategy"],
    internalLinks: [],
    externalLinks: [],
    hasJsonLd: false,
    wordCount: 250,
  },
  robots: {
    sourceUrl: "https://example.com/robots.txt",
    retrievedAt: "2026-07-12T08:00:01.000Z",
    status: 200,
    content: "User-agent: *\nAllow: /",
  },
  sitemap: null,
  errors: ["sitemap: HTTP 404"],
};

vi.mock("../../../lib/seo/evidence", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/seo/evidence")>(
    "../../../lib/seo/evidence",
  );
  return { ...actual, collectWebsiteEvidence: collectWebsiteEvidenceMock };
});

vi.mock("../../../lib/hermes-runner", () => ({
  startHermesRun: startHermesRunMock,
}));

import { POST } from "./route";

describe("POST /api/audits", () => {
  beforeEach(() => {
    collectWebsiteEvidenceMock.mockResolvedValue(report);
    startHermesRunMock.mockResolvedValue({
      runId: "20260712T080000Z-example-com",
      status: "starting",
      startedAt: "2026-07-12T08:00:00.000Z",
      message: "Starting agents.",
    });
  });

  afterEach(() => {
    collectWebsiteEvidenceMock.mockReset();
    startHermesRunMock.mockReset();
  });

  it("rejects a request without a website URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/audits", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("stops reading an oversized chunked body", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(10_001)));
        controller.close();
      },
    });
    const response = await POST(
      new Request("http://localhost/api/audits", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );

    expect(response.status).toBe(413);
    expect(collectWebsiteEvidenceMock).not.toHaveBeenCalled();
  });

  it("fails clearly when the hosted deployment has no Hermes runtime", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(
      new Request("https://seo-agent-orchestrator.vercel.app/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("local Hermes runtime");
    expect(collectWebsiteEvidenceMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("starts diagnostics and copy generation without a dashboard access token", async () => {
    vi.stubEnv("DASHBOARD_ACCESS_TOKEN", "configured-but-not-required");
    const response = await POST(
      new Request("http://localhost/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.audit.business.host).toBe("example.com");
    expect(payload.evidence.robots).toEqual({
      sourceUrl: "https://example.com/robots.txt",
      retrievedAt: "2026-07-12T08:00:01.000Z",
      status: 200,
    });
    expect(payload.evidence.robots.content).toBeUndefined();
    expect(payload.run.status).toBe("starting");
    expect(startHermesRunMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/",
      pageType: "unknown",
    }), report);
    vi.unstubAllEnvs();
  });
});
