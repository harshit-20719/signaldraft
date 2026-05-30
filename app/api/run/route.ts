import { z } from "zod";
import { runPipeline } from "@/lib/pipeline";
import { saveRun } from "@/lib/store";
import { checkRateLimit } from "@/lib/ratelimit";
import type { RunStreamMessage } from "@/lib/types";

// POST /api/run — the public entry point to the engine. It runs the pipeline
// and streams each stage event back as newline-delimited JSON (NDJSON) so the
// browser can render the run live, stage by stage, instead of waiting for the
// whole thing. On completion it saves the run to the shared store and streams
// the final record.
//
// Runtime config is pinned up front (KTD3) so the serverless platform does not
// buffer the stream (which would defeat the live feel) or cut the run short:
export const runtime = "nodejs"; // Node, not Edge — the SDKs need it
export const dynamic = "force-dynamic"; // never cache/prerender; run per request
export const maxDuration = 60; // a run makes several Claude+Tavily calls

// What the browser must send. Validated server-side so a malformed request gets
// a clear 400 instead of crashing the pipeline.
const ProspectSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().trim().min(1, "Company is required"),
  role: z.string().trim().optional(),
  hint: z.string().trim().optional(),
});

const SellerSchema = z.object({
  company: z.string().trim().min(1),
  product: z.string().trim().min(1),
  valueProps: z.array(z.string()),
  targetBuyer: z.string().trim().min(1),
});

const RunRequestSchema = z.object({
  prospect: ProspectSchema,
  seller: SellerSchema,
});

// Best-effort client IP for the per-IP rate limit. On Vercel the real client is
// the first hop in x-forwarded-for; locally that header is usually absent.
function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(request: Request) {
  // 1) Parse + validate the body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = RunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { prospect, seller } = parsed.data;

  // 2) Rate limit (KTD10) — soft per-IP cap, before spending any money.
  const limit = await checkRateLimit(clientIp(request));
  if (!limit.allowed) {
    return Response.json(
      { error: "Rate limit reached — try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // 3) Stream the run. We drive the async generator by hand (rather than
  // for-await) because its *return* value is the finished RunRecord, which a
  // for-await loop would discard.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: RunStreamMessage) =>
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
      try {
        const gen = runPipeline(prospect, seller);
        let step = await gen.next();
        while (!step.done) {
          send({ type: "event", event: step.value });
          step = await gen.next();
        }
        const record = step.value;
        // Persistence is best-effort: a store hiccup must not turn a completed
        // run into an error for the user — they still get their result.
        try {
          await saveRun(record);
        } catch (err) {
          console.error("[signaldraft] saveRun failed:", err);
        }
        send({ type: "record", record });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Run failed unexpectedly.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      // Defeat caching and proxy buffering so events flush incrementally.
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
