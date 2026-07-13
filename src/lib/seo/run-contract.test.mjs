import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateRunArtifacts } from "../../../scripts/seo-run-contract.mjs";

const directories = [];

async function runDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "seo-contract-"));
  directories.push(directory);
  return directory;
}

async function writeValidArtifacts(directory) {
  const artifacts = {
    "site-evidence.json": JSON.stringify({ targetUrl: "https://example.com/" }),
    "market-evidence.md": "# Market evidence\n\nCited observations.",
    "backlog.json": JSON.stringify([{ id: "opportunity-1", selected: true }]),
    "draft.md": "# Draft\n\nFirst copy candidate.",
    "qc.md": "# First review\n\nVerdict: REJECT\n\n# Revised review\n\nVerdict: PASS",
    "final.md": "# Final copy\n\nApproval-ready candidate.",
    "run-state.json": JSON.stringify({ status: "AWAITING_COPY_APPROVAL" }),
    "run-summary.md": "# Summary\n\nReady for copy approval.",
  };
  await Promise.all(Object.entries(artifacts).map(([file, content]) =>
    writeFile(path.join(directory, file), content)
  ));
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("validateRunArtifacts", () => {
  it("accepts a complete run whose final QC verdict passes", async () => {
    const directory = await runDirectory();
    await writeValidArtifacts(directory);

    await expect(validateRunArtifacts(directory)).resolves.toEqual({
      valid: true,
      errors: [],
      missingArtifacts: [],
    });
  });

  it("rejects malformed JSON and a final QC rejection", async () => {
    const directory = await runDirectory();
    await writeValidArtifacts(directory);
    await writeFile(path.join(directory, "backlog.json"), "{broken");
    await writeFile(path.join(directory, "qc.md"), "Verdict: PASS\n\nVerdict: REJECT");

    const result = await validateRunArtifacts(directory);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "backlog.json is not valid JSON.",
      "The final QC verdict is not PASS.",
    ]));
  });

  it("rejects empty, oversized, and non-file deliverables", async () => {
    const directory = await runDirectory();
    await writeValidArtifacts(directory);
    await writeFile(path.join(directory, "final.md"), "");
    await writeFile(path.join(directory, "run-summary.md"), "x".repeat(300_000));

    const result = await validateRunArtifacts(directory);

    expect(result.valid).toBe(false);
    expect(result.missingArtifacts).toContain("final.md");
    expect(result.errors).toContain("run-summary.md exceeds the 256 KB artifact limit.");
  });
});
