import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as pinnedFetch } from "undici";

const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

export type PageEvidence = {
  sourceUrl: string;
  retrievedAt: string;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsDirective: string | null;
  h1: string[];
  h2: string[];
  internalLinks: string[];
  externalLinks: string[];
  hasJsonLd: boolean;
  wordCount: number;
};

export type ResourceEvidence = {
  sourceUrl: string;
  retrievedAt: string;
  status: number;
  content: string;
};

export type WebsiteEvidenceReport = {
  targetUrl: string;
  collectedAt: string;
  page: PageEvidence;
  pageResource: Omit<ResourceEvidence, "content">;
  robots: ResourceEvidence | null;
  sitemap: ResourceEvidence | null;
  errors: string[];
};

export type ResourceFetcher = (url: string) => Promise<ResourceEvidence>;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    octets[0] >= 224
  );
}

function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  if (isIP(address) !== 6) return false;

  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export function validatePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Target must be a valid URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS targets are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are not supported.");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIp(hostname)) {
    throw new Error("Private-network targets are not supported.");
  }

  return url;
}

async function resolvePublicDnsTarget(url: URL) {
  const results = await lookup(url.hostname, { all: true, verbatim: true });
  if (results.length === 0 || results.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Target resolves to a private or unavailable network address.");
  }
  return results;
}

async function readBoundedText(response: {
  headers: { get(name: string): string | null };
  body: {
    getReader(): {
      read(): Promise<{ done: true; value?: undefined } | { done: false; value: Uint8Array }>;
      cancel(): Promise<unknown>;
    };
  } | null;
}): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Response exceeds the 2 MB evidence limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Response exceeds the 2 MB evidence limit.");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function fetchPublicResource(value: string): Promise<ResourceEvidence> {
  let url = validatePublicHttpUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = await resolvePublicDnsTarget(url);
    const target = addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      },
    });
    try {
      const response = await pinnedFetch(url, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.1",
          "user-agent": "KairoSEOOperator/0.1 (+evidence-analysis)",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Redirect from ${url.toString()} did not include a location.`);
        }
        url = validatePublicHttpUrl(new URL(location, url).toString());
        continue;
      }

      return {
        sourceUrl: url.toString(),
        retrievedAt: new Date().toISOString(),
        status: response.status,
        content: await readBoundedText(response),
      };
    } finally {
      await dispatcher.close();
    }
  }

  throw new Error(`Target exceeded ${MAX_REDIRECTS} redirects.`);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function extractPageEvidence(
  html: string,
  sourceUrl: string,
  retrievedAt = new Date().toISOString(),
): PageEvidence {
  const pageUrl = validatePublicHttpUrl(sourceUrl);
  const $ = cheerio.load(html);

  $("script:not([type='application/ld+json']), style, noscript, template").remove();

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    try {
      const resolved = new URL(href, pageUrl);
      if (!["http:", "https:"].includes(resolved.protocol)) return;
      const target = resolved.toString();
      if (resolved.origin === pageUrl.origin) internalLinks.push(target);
      else externalLinks.push(target);
    } catch {
      // Invalid links are omitted from structured evidence.
    }
  });

  const bodyText = cleanText($("body").text());
  return {
    sourceUrl: pageUrl.toString(),
    retrievedAt,
    title: cleanText($("title").first().text()) || null,
    metaDescription: cleanText($("meta[name='description' i]").attr("content") ?? "") || null,
    canonicalUrl: $("link[rel~='canonical' i]").attr("href")
      ? new URL($("link[rel~='canonical' i]").attr("href")!, pageUrl).toString()
      : null,
    robotsDirective: cleanText($("meta[name='robots' i]").attr("content") ?? "") || null,
    h1: $("h1").map((_, element) => cleanText($(element).text())).get().filter(Boolean),
    h2: $("h2").map((_, element) => cleanText($(element).text())).get().filter(Boolean),
    internalLinks: unique(internalLinks),
    externalLinks: unique(externalLinks),
    hasJsonLd: $("script[type='application/ld+json']").length > 0,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
  };
}

function sitemapUrlFromRobots(content: string): string | null {
  const line = content
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => /^sitemap\s*:/i.test(value));
  return line ? line.replace(/^sitemap\s*:\s*/i, "").trim() || null : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchSuccessfulResource(
  url: string,
  fetcher: ResourceFetcher,
): Promise<ResourceEvidence> {
  const resource = await fetcher(url);
  if (resource.status < 200 || resource.status >= 300) {
    throw new Error(`HTTP ${resource.status}`);
  }
  return resource;
}

export async function collectWebsiteEvidence(
  target: string,
  fetcher: ResourceFetcher = fetchPublicResource,
): Promise<WebsiteEvidenceReport> {
  const targetUrl = validatePublicHttpUrl(target);
  const pageResource = await fetcher(targetUrl.toString());
  if (pageResource.status < 200 || pageResource.status >= 300) {
    throw new Error(`HTTP ${pageResource.status}`);
  }
  const page = extractPageEvidence(
    pageResource.content,
    pageResource.sourceUrl,
    pageResource.retrievedAt,
  );
  const errors: string[] = [];
  let robots: ResourceEvidence | null = null;
  let sitemap: ResourceEvidence | null = null;

  try {
    robots = await fetchSuccessfulResource(
      new URL("/robots.txt", targetUrl.origin).toString(),
      fetcher,
    );
  } catch (error) {
    errors.push(`robots.txt: ${errorMessage(error)}`);
  }

  const discoveredSitemap = robots ? sitemapUrlFromRobots(robots.content) : null;
  const sitemapUrl = discoveredSitemap ?? new URL("/sitemap.xml", targetUrl.origin).toString();
  try {
    sitemap = await fetchSuccessfulResource(
      validatePublicHttpUrl(sitemapUrl).toString(),
      fetcher,
    );
  } catch (error) {
    errors.push(`sitemap: ${errorMessage(error)}`);
  }

  return {
    targetUrl: targetUrl.toString(),
    collectedAt: new Date().toISOString(),
    page,
    pageResource: {
      sourceUrl: pageResource.sourceUrl,
      retrievedAt: pageResource.retrievedAt,
      status: pageResource.status,
    },
    robots,
    sitemap,
    errors,
  };
}
