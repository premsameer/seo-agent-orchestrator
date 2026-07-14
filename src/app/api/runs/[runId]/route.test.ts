import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHermesRunStatus } = vi.hoisted(() => ({ getHermesRunStatus: vi.fn() }));
vi.mock("../../../../lib/hermes-runner", () => ({
  getHermesRunStatus,
  isValidRunId: (runId: string) => /^\d{8}T\d{6}Z-[a-z0-9-]{1,60}(?:-[a-f0-9]{8})?$/.test(runId),
}));

import { GET } from "./route";

const request = new Request("http://localhost/api/runs/test");
const params = (runId: string) => ({ params: Promise.resolve({ runId }) });

describe("run status route", () => {
  beforeEach(() => getHermesRunStatus.mockReset());

  it("rejects malformed run IDs without reading run state", async () => {
    const response = await GET(request, params("undefined"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid run ID." });
    expect(getHermesRunStatus).not.toHaveBeenCalled();
  });

  it("reports temporary status-read failures as retryable service errors", async () => {
    getHermesRunStatus.mockRejectedValueOnce(new SyntaxError("transient status read"));

    const response = await GET(request, params("20260714T081547Z-seo-ai-d7d1155f"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Run status is temporarily unavailable." });
  });

  it("returns 404 for a valid run ID that no longer exists", async () => {
    getHermesRunStatus.mockResolvedValueOnce(null);

    const response = await GET(request, params("20260714T081547Z-seo-ai-d7d1155f"));

    expect(response.status).toBe(404);
  });
});
