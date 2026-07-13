import { describe, expect, it } from "vitest";
import {
  collectWebsiteEvidence,
  extractPageEvidence,
  validatePublicHttpUrl,
  type ResourceEvidence,
} from "./evidence";

describe("extractPageEvidence", () => {
  it("extracts auditable on-page SEO signals without executing page code", () => {
    const html = `<!doctype html>
      <html><head>
        <title>UK Masters Admissions | Example Education</title>
        <meta name="description" content="Book a consultation for UK masters admissions support.">
        <meta name="robots" content="index,follow">
        <link rel="canonical" href="https://example.com/services/uk-masters">
        <script type="application/ld+json">{"@type":"Service"}</script>
      </head><body>
        <h1>UK Masters Admissions Consulting</h1>
        <h2>How we help</h2>
        <p>Evidence-led guidance for applicants.</p>
        <a href="/contact">Book a consultation</a>
        <a href="https://partner.example/resources">Partner resource</a>
      </body></html>`;

    const evidence = extractPageEvidence(
      html,
      "https://example.com/services/uk-masters",
      "2026-07-12T08:00:00.000Z",
    );

    expect(evidence.title).toBe("UK Masters Admissions | Example Education");
    expect(evidence.metaDescription).toContain("Book a consultation");
    expect(evidence.canonicalUrl).toBe("https://example.com/services/uk-masters");
    expect(evidence.h1).toEqual(["UK Masters Admissions Consulting"]);
    expect(evidence.h2).toEqual(["How we help"]);
    expect(evidence.internalLinks).toEqual(["https://example.com/contact"]);
    expect(evidence.externalLinks).toEqual(["https://partner.example/resources"]);
    expect(evidence.hasJsonLd).toBe(true);
    expect(evidence.sourceUrl).toBe("https://example.com/services/uk-masters");
    expect(evidence.retrievedAt).toBe("2026-07-12T08:00:00.000Z");
  });
});

describe("validatePublicHttpUrl", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "file:///etc/passwd",
    "https://user:password@example.com",
  ])("rejects unsafe target %s", (url) => {
    expect(() => validatePublicHttpUrl(url)).toThrow();
  });

  it("normalizes a public HTTPS target", () => {
    expect(validatePublicHttpUrl("https://example.com/services").toString()).toBe(
      "https://example.com/services",
    );
  });
});

describe("collectWebsiteEvidence", () => {
  it("preserves page, robots, and sitemap sources in one report", async () => {
    const resources = new Map<string, ResourceEvidence>([
      [
        "https://example.com/services",
        {
          sourceUrl: "https://example.com/services",
          retrievedAt: "2026-07-12T08:00:00.000Z",
          status: 200,
          content: "<html><head><title>Services</title></head><body><h1>Services</h1></body></html>",
        },
      ],
      [
        "https://example.com/robots.txt",
        {
          sourceUrl: "https://example.com/robots.txt",
          retrievedAt: "2026-07-12T08:00:01.000Z",
          status: 200,
          content: "User-agent: *\nSitemap: https://example.com/sitemap.xml",
        },
      ],
      [
        "https://example.com/sitemap.xml",
        {
          sourceUrl: "https://example.com/sitemap.xml",
          retrievedAt: "2026-07-12T08:00:02.000Z",
          status: 200,
          content: "<urlset><url><loc>https://example.com/services</loc></url></urlset>",
        },
      ],
    ]);

    const report = await collectWebsiteEvidence("https://example.com/services", async (url) => {
      const resource = resources.get(url);
      if (!resource) throw new Error(`Unexpected URL: ${url}`);
      return resource;
    });

    expect(report.page.title).toBe("Services");
    expect(report.robots?.sourceUrl).toBe("https://example.com/robots.txt");
    expect(report.sitemap?.sourceUrl).toBe("https://example.com/sitemap.xml");
    expect(report.errors).toEqual([]);
  });

  it("reports missing robots and sitemap resources instead of treating 404 pages as valid", async () => {
    const fetcher = async (url: string): Promise<ResourceEvidence> => ({
      sourceUrl: url,
      retrievedAt: "2026-07-12T08:00:00.000Z",
      status: url.endsWith("/services") ? 200 : 404,
      content: url.endsWith("/services")
        ? "<html><head><title>Services</title></head><body><h1>Services</h1></body></html>"
        : "Not found",
    });

    const report = await collectWebsiteEvidence("https://example.com/services", fetcher);

    expect(report.robots).toBeNull();
    expect(report.sitemap).toBeNull();
    expect(report.errors).toEqual(["robots.txt: HTTP 404", "sitemap: HTTP 404"]);
  });

  it("rejects a non-success primary page instead of auditing an error document", async () => {
    await expect(
      collectWebsiteEvidence("https://example.com/missing", async (url) => ({
        sourceUrl: url,
        retrievedAt: "2026-07-12T08:00:00.000Z",
        status: 404,
        content: "<html><title>Not found</title><h1>Not found</h1></html>",
      })),
    ).rejects.toThrow("HTTP 404");
  });
});
