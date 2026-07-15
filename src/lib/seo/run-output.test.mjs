import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractHermesSessionId, outputNeedsResume, parseAgentPackage, parseAgentPackageWithRetry, writeAgentPackage } from "../../../scripts/seo-run-output.mjs";
import { validateRunArtifacts } from "../../../scripts/seo-run-contract.mjs";
import { KAIRO_SAMPLE_OPERATION } from "../kairo-operation";

const directories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "seo-output-"));
  directories.push(directory);
  return directory;
}

const packagePayload = {
  marketEvidence: "# Market evidence\n\nCited observations.",
  backlog: [{ id: "opportunity-1", selected: true }],
  draft: "# Draft\n\nFirst candidate.",
  qualityReview: "Verdict: REJECT\n\nVerdict: PASS",
  final: "# Final\n\nApproval-ready candidate.",
  runState: { status: "AWAITING_COPY_APPROVAL" },
  runSummary: "# Summary\n\nReady for copy approval.",
  operationResult: KAIRO_SAMPLE_OPERATION,
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("agent output package", () => {
  it("parses a fenced JSON package without trusting surrounding output", () => {
    const output = `Completed safely.\n\n\`\`\`json\n${JSON.stringify(packagePayload)}\n\`\`\`\n\nsession_id: ignored`;
    expect(parseAgentPackage(output)).toEqual(packagePayload);
  });

  it("writes only the allow-listed run artifacts atomically", async () => {
    const directory = await temporaryDirectory();
    await writeFile(path.join(directory, "site-evidence.json"), JSON.stringify({ targetUrl: "https://example.com/" }));

    await writeAgentPackage(directory, packagePayload);

    await expect(validateRunArtifacts(directory)).resolves.toMatchObject({ valid: true });
    await expect(readFile(path.join(directory, "final.md"), "utf8")).resolves.toBe(packagePayload.final);
  });

  it("rejects missing or unexpected package fields", () => {
    expect(() => parseAgentPackage(JSON.stringify({ ...packagePayload, final: undefined }))).toThrow("final");
    expect(() => parseAgentPackage(JSON.stringify({ ...packagePayload, unexpected: "value" }))).toThrow("unexpected");
  });

  it("rejects an operation result without exactly three scored opportunities", () => {
    expect(() => parseAgentPackage(JSON.stringify({
      ...packagePayload,
      operationResult: {
        ...KAIRO_SAMPLE_OPERATION,
        opportunities: KAIRO_SAMPLE_OPERATION.opportunities.slice(0, 2),
      },
    }))).toThrow("exactly three opportunities");
  });

  it("rejects ratings that the API-side operation validator would reject", () => {
    expect(() => parseAgentPackage(JSON.stringify({
      ...packagePayload,
      operationResult: {
        ...KAIRO_SAMPLE_OPERATION,
        opportunities: KAIRO_SAMPLE_OPERATION.opportunities.map((opportunity, index) => index === 0
          ? { ...opportunity, effort: -2, priorityScore: -12.5 }
          : opportunity),
      },
    }))).toThrow("ratings must be integers from 1 to 5");
  });

  it("rejects an incomplete structured recommendation", () => {
    expect(() => parseAgentPackage(JSON.stringify({
      ...packagePayload,
      operationResult: {
        ...KAIRO_SAMPLE_OPERATION,
        recommendation: { ...KAIRO_SAMPLE_OPERATION.recommendation, faqs: undefined },
      },
    }))).toThrow("operationResult.recommendation.faqs");
  });

  it("normalizes common structured model shapes before validation", () => {
    const operationResult = {
      ...KAIRO_SAMPLE_OPERATION,
      opportunities: KAIRO_SAMPLE_OPERATION.opportunities.map((opportunity, index) => index === 1
        ? { ...opportunity, evidence: opportunity.evidence[0], commercialIntent: "Very high" }
        : opportunity),
      recommendation: {
        ...KAIRO_SAMPLE_OPERATION.recommendation,
        faqs: [
          { question: "What is included?", answer: "The verified readiness workflow." },
          ...KAIRO_SAMPLE_OPERATION.recommendation.faqs.slice(1),
        ],
        changeExplanation: "Clarifies the commercial offer.",
      },
      qualityReview: {
        ...KAIRO_SAMPLE_OPERATION.qualityReview,
        claimsVerified: ["Offer verified.", "CTA verified."],
      },
      evidence: [{ source: "Homepage", url: "https://example.com", supports: ["Offer", "CTA"] }],
    };

    const parsed = parseAgentPackage(JSON.stringify({ ...packagePayload, operationResult }));

    expect(parsed.operationResult.opportunities[1].evidence).toEqual([KAIRO_SAMPLE_OPERATION.opportunities[1].evidence[0]]);
    expect(parsed.operationResult.opportunities[1].commercialIntent).toBe("high");
    expect(parsed.operationResult.recommendation.faqs[0]).toContain("What is included?");
    expect(parsed.operationResult.qualityReview.claimsVerified).toContain("Offer verified.");
  });

  it("allows one repair attempt for malformed model output", async () => {
    let attempts = 0;
    const result = await parseAgentPackageWithRetry("not json", async () => {
      attempts += 1;
      return JSON.stringify(packagePayload);
    });

    expect(attempts).toBe(1);
    expect(result.operationResult.selectedOpportunityId).toBe("soc2-page-positioning");
  });

  it("detects a provisional background-task response and extracts its session", () => {
    const provisional = `Background task running\nsession_id: 20260714_052304_f17467\n${JSON.stringify({
      ...packagePayload,
      final: "",
      runState: { status: "IN_PROGRESS" },
    })}`;

    expect(outputNeedsResume(provisional)).toBe(true);
    expect(extractHermesSessionId(provisional)).toBe("20260714_052304_f17467");
    expect(outputNeedsResume(JSON.stringify(packagePayload))).toBe(false);
  });
});
