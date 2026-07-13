import { describe, expect, it } from "vitest";
import { evaluateBrief } from "./brief";

describe("evaluateBrief", () => {
  it("accepts a complete commercial-page brief", () => {
    const result = evaluateBrief({
      url: "https://example.com/services/uk-masters",
      objective: "Increase qualified consultation requests from Indian students applying for UK master's programmes.",
      pageType: "commercial",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.recommendedAction).toContain("commercial page");
    }
  });

  it("rejects localhost and private network targets", () => {
    for (const url of ["http://localhost:3000", "http://127.0.0.1", "http://192.168.1.4"]) {
      expect(evaluateBrief({ url, objective: "Grow qualified leads for our service business.", pageType: "commercial" }).ok).toBe(false);
    }
  });

  it("rejects URLs containing credentials", () => {
    expect(evaluateBrief({
      url: "https://admin:secret@example.com",
      objective: "Grow qualified leads for our service business.",
      pageType: "commercial",
    }).ok).toBe(false);
  });

  it("returns useful missing-context guidance for a vague objective", () => {
    const result = evaluateBrief({
      url: "https://example.com",
      objective: "more traffic",
      pageType: "unknown",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBeLessThan(70);
      expect(result.missingContext.length).toBeGreaterThan(0);
    }
  });
});
