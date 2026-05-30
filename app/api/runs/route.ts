import { listRuns } from "@/lib/store";

// GET /api/runs — the dashboard's data source: recent runs, newest-first (U8).
// force-dynamic so it always reflects the live store, never a cached/empty list.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await listRuns();
    return Response.json({ runs });
  } catch (err) {
    console.error("[signaldraft] listRuns failed:", err);
    return Response.json({ error: "Could not load runs." }, { status: 500 });
  }
}
