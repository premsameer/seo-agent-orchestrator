import { getHermesRunStatus } from "../../../../lib/hermes-runner";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await params;
    const run = await getHermesRunStatus(runId);
    if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
    return Response.json({ ...run, pid: undefined }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return Response.json({ error: "Invalid run." }, { status: 400 });
  }
}
