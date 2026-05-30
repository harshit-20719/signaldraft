import { getRun } from "@/lib/store";

// GET /api/runs/[id] — fetch one saved run, for reopening it by URL (U8/U11).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE (Next.js 16): the dynamic route `params` is now a Promise and must be
// awaited — the older synchronous `params.id` no longer works.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const run = await getRun(id);
    if (!run) {
      return Response.json({ error: "Run not found." }, { status: 404 });
    }
    return Response.json({ run });
  } catch (err) {
    console.error("[signaldraft] getRun failed:", err);
    return Response.json({ error: "Could not load run." }, { status: 500 });
  }
}
