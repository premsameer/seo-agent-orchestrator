import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRunView, readRunArtifacts } from "./hermes-runner";

const temporaryDirectories: string[] = [];

async function temporaryRunDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "hermes-seo-run-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("readRunArtifacts", () => {
  it("returns generated copy and QC artifacts for the dashboard", async () => {
    const runDirectory = await temporaryRunDirectory();
    await Promise.all([
      writeFile(path.join(runDirectory, "final.md"), "# Final copy\n\nA supported page promise."),
      writeFile(path.join(runDirectory, "qc.md"), "# QC\n\nVerdict: PASS"),
      writeFile(path.join(runDirectory, "run-summary.md"), "# Summary\n\nCopy is ready for approval."),
    ]);

    await expect(readRunArtifacts(runDirectory)).resolves.toEqual({
      finalCopy: "# Final copy\n\nA supported page promise.",
      qualityReview: "# QC\n\nVerdict: PASS",
      summary: "# Summary\n\nCopy is ready for approval.",
    });
  });

  it("returns null fields while agents have not produced artifacts", async () => {
    const runDirectory = await temporaryRunDirectory();

    await expect(readRunArtifacts(runDirectory)).resolves.toEqual({
      finalCopy: null,
      qualityReview: null,
      summary: null,
    });
  });
});

describe("buildRunView", () => {
  it("shows genuine artifact milestones and only activates dependent agents", async () => {
    const runDirectory = await temporaryRunDirectory();
    await Promise.all([
      writeFile(path.join(runDirectory, "site-evidence.json"), "{}"),
      writeFile(path.join(runDirectory, "market-evidence.md"), "# Market evidence"),
      writeFile(path.join(runDirectory, "draft.md"), "# Draft"),
    ]);

    const view = await buildRunView({
      runId: "20260713T175422Z-example-com",
      status: "running",
      startedAt: "2026-07-13T17:54:22.254Z",
      message: "Agents are working.",
    }, runDirectory);

    expect(view.progress.percent).toBeGreaterThan(30);
    expect(view.progress.stages.map(({ status }) => status)).toEqual([
      "working",
      "complete",
      "complete",
      "working",
      "working",
    ]);
    expect(view.progress.events.map(({ label }) => label)).toEqual(expect.arrayContaining([
      "First-party diagnostics saved",
      "Market evidence packet completed",
      "Draft copy created",
    ]));
  });

  it("marks a zero-exit run as failed when required deliverables are missing", async () => {
    const runDirectory = await temporaryRunDirectory();
    await writeFile(path.join(runDirectory, "site-evidence.json"), "{}");

    const view = await buildRunView({
      runId: "20260713T175422Z-example-com",
      status: "complete",
      startedAt: "2026-07-13T17:54:22.254Z",
      finishedAt: "2026-07-13T17:58:06.896Z",
      message: "Agent exited successfully.",
    }, runDirectory);

    expect(view.status).toBe("failed");
    expect(view.message).toContain("required deliverables");
    expect(view.progress.missingArtifacts).toContain("final.md");
    expect(view.progress.stages[2].status).toBe("failed");
  });
});
