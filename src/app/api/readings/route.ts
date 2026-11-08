import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICES } from "@/config/devices";
import { listReadings } from "@/lib/db/repository";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";

const querySchema = z.object({
  serial: z.string().regex(/^\d{8}$/).optional(),
  range: z.enum(["24h", "7d", "30d"]).default("24h"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  if (isRateLimited(request, "readings")) return rateLimitedResponse();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parameter query tidak valid." }, { status: 400 });
  if (parsed.data.serial && !DEVICES.some((device) => device.serial === parsed.data.serial)) {
    return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  }
  const durationMs = { "24h": 24 * 60 * 60_000, "7d": 7 * 24 * 60 * 60_000, "30d": 30 * 24 * 60 * 60_000 }[parsed.data.range];
  try {
    const rows = await listReadings(parsed.data.serial, 500);
    const filtered = rows
      .filter((reading) => Date.parse(reading.receivedAt) >= Date.now() - durationMs)
      .slice(parsed.data.offset, parsed.data.offset + parsed.data.limit);
    return NextResponse.json({ readings: filtered, limit: parsed.data.limit, offset: parsed.data.offset }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/readings failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Histori pembacaan tidak dapat dimuat." }, { status: 503 });
  }
}
