import { getHermesRunStatus, isValidRunId } from "../../../../lib/hermes-runner";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  if (!isValidRunId(runId)) {
    return Response.json({ error: "Invalid run ID." }, { status: 400 });
  }
  try {
    const run = await getHermesRunStatus(runId);
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    return Response.json({ ...run, pid: undefined }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (error) {
    console.error("Run status read failed", { runId, error });
    return Response.json({ error: "Run status is temporarily unavailable." }, { status: 503 });
  }
}
