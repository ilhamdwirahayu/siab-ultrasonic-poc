import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICES } from "@/config/devices";
import { listReadings } from "@/lib/db/repository";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";
import type { Reading } from "@/types/telemetry";

const querySchema = z.object({
  serial: z.string().regex(/^\d{8}$/).optional(),
  range: z.enum(["1h", "6h", "12h", "24h", "7d", "30d"]).default("24h"),
  limit: z.coerce.number().int().min(1).max(10_000).default(100),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  if (isRateLimited(request, "readings")) return rateLimitedResponse();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parameter query tidak valid." }, { status: 400 });
  if (parsed.data.serial && !DEVICES.some((device) => device.serial === parsed.data.serial)) {
    return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  }
  const durationMs = {
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "12h": 12 * 60 * 60_000,
    "24h": 24 * 60 * 60_000,
    "7d": 7 * 24 * 60 * 60_000,
    "30d": 30 * 24 * 60 * 60_000,
  }[parsed.data.range];
  const since = new Date(Date.now() - durationMs).toISOString();
  try {
    const rows = await listReadings(parsed.data.serial, parsed.data.offset + parsed.data.limit, since);
    const filtered = rows
      .filter((reading) => Date.parse(reading.receivedAt) >= Date.parse(since))
      .slice(parsed.data.offset, parsed.data.offset + parsed.data.limit);
    return NextResponse.json({ readings: filtered.map(toPublicReading), limit: parsed.data.limit, offset: parsed.data.offset }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/readings failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Histori pembacaan tidak dapat dimuat." }, { status: 503 });
  }
}

function toPublicReading(reading: Reading): Reading {
  return {
    id: reading.id,
    serial: reading.serial,
    devEui: reading.devEui,
    receivedAt: reading.receivedAt,
    radioGpsTime: reading.radioGpsTime,
    meterTime: reading.meterTime,
    forwardM3: reading.forwardM3,
    reverseM3: reading.reverseM3,
    flowM3PerHour: reading.flowM3PerHour,
    temperatureC: reading.temperatureC,
    statusRaw: reading.statusRaw,
    decodeStatus: reading.decodeStatus,
    decodeMessage: reading.decodeMessage,
    payloadHex: reading.payloadHex,
    port: reading.port,
    frequencyMHz: reading.frequencyMHz,
    spreadingFactor: reading.spreadingFactor,
    rssi: reading.rssi,
    snr: reading.snr,
    counter: reading.counter,
    source: reading.source,
  };
}
