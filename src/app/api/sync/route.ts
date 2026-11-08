import { NextResponse } from "next/server";
import { DEVICES } from "@/config/devices";
import { backfillDevice, fetchLatestForDevice, writeSyncLog } from "@/lib/antares/client";
import { isAllowedSyncToken, isDemoMode } from "@/lib/api";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
let lastSyncAt = 0;
const minimumIntervalMs = 60_000;

export async function POST(request: Request) {
  if (isRateLimited(request, "sync-auth", 10)) return rateLimitedResponse();
  if (isDemoMode()) return NextResponse.json({ error: "Sinkronisasi ANTARES nonaktif dalam mode demo." }, { status: 409 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!isAllowedSyncToken(token)) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const query = z.object({
    backfill: z.enum(["true", "false"]).optional(),
    serial: z.string().regex(/^\d{8}$/).optional(),
  })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Parameter sinkronisasi tidak valid." }, { status: 400 });
  if (query.data.serial && !DEVICES.some((device) => device.serial === query.data.serial)) {
    return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  }
  if (isRateLimited(request, "sync", 1)) return rateLimitedResponse();

  if (Date.now() - lastSyncAt < minimumIntervalMs) {
    return NextResponse.json({ error: "Batas sinkronisasi 1 menit tercapai." }, { status: 429 });
  }
  lastSyncAt = Date.now();
  const backfill = query.data.backfill === "true";

  const selectedDevices = DEVICES.filter((device) => !query.data.serial || device.serial === query.data.serial);
  const results = await Promise.all(selectedDevices.map(async (device) => {
    let latest: Awaited<ReturnType<typeof fetchLatestForDevice>> = null;
    let latestError: string | null = null;
    let latestInserted = false;
    const startedAt = new Date().toISOString();
    let history: Awaited<ReturnType<typeof backfillDevice>> | undefined;
    let historyError: string | null = null;
    try {
      latest = await fetchLatestForDevice(device.serial, { onPersist: (inserted) => { latestInserted = inserted; } });
    } catch (error) {
      latestError = error instanceof Error ? error.message : "Unknown ANTARES latest error.";
      console.error("ANTARES latest sync failed", { serial: device.serial, message: latestError });
    }
    await logSyncSafely({
      operation: "latest",
      meterSerial: device.serial,
      status: latest ? "success" : "failed",
      fetched: latest ? 1 : 0,
      inserted: latest && latestInserted ? 1 : 0,
      duplicates: latest && !latestInserted ? 1 : 0,
      failed: latest ? 0 : 1,
      startedAt,
      errorMessage: latestError,
    }, device.serial);
    if (backfill) {
      const backfillStartedAt = new Date().toISOString();
      try {
        history = await backfillDevice(device.serial);
      } catch (error) {
        historyError = error instanceof Error ? error.message : "Unknown ANTARES history error.";
        console.error("ANTARES backfill failed", { serial: device.serial, message: historyError });
      }
      await logSyncSafely({
        operation: "backfill",
        meterSerial: device.serial,
        status: historyError ? "failed" : history?.failed ? "partial" : "success",
        fetched: history?.fetched ?? 0,
        inserted: history?.inserted ?? 0,
        duplicates: history?.duplicates ?? 0,
        failed: history?.failed ?? 1,
        startedAt: backfillStartedAt,
        errorMessage: historyError,
      }, device.serial);
    }
    return {
      serial: device.serial,
      ok: latest !== null || (history !== undefined && history.fetched > 0),
      receivedAt: latest?.receivedAt ?? null,
      latestError,
      history,
      historyError,
    };
  }));
  const successCount = results.filter((result) => result.ok).length;
  return NextResponse.json({ results, successCount }, { status: successCount ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}

async function logSyncSafely(
  input: Parameters<typeof writeSyncLog>[0],
  meterSerial: string,
): Promise<void> {
  try {
    await writeSyncLog(input);
  } catch (error) {
    console.error("ANTARES sync log write failed", {
      serial: meterSerial,
      message: error instanceof Error ? error.message : "Unknown sync log error.",
    });
  }
}
