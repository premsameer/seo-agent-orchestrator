import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAgentPackage, writeAgentPackage } from "../../../scripts/seo-run-output.mjs";
import { validateRunArtifacts } from "../../../scripts/seo-run-contract.mjs";

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
});
