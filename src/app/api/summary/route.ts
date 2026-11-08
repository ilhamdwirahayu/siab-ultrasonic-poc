import { NextResponse } from "next/server";
import { z } from "zod";
import { getSummary } from "@/lib/db/repository";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";

const querySchema = z.object({ range: z.enum(["24h", "7d", "30d"]).default("24h") });

export async function GET(request: Request) {
  if (isRateLimited(request, "summary")) return rateLimitedResponse();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Rentang waktu tidak valid." }, { status: 400 });
  try {
    return NextResponse.json({ summary: await getSummary(), range: parsed.data.range }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/summary failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Ringkasan tidak dapat dimuat." }, { status: 503 });
  }
}
