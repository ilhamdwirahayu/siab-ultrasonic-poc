import { NextResponse } from "next/server";
import { z } from "zod";
import { DEVICES } from "@/config/devices";
import { listDevices } from "@/lib/db/repository";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";

const paramsSchema = z.object({ serial: z.string().regex(/^\d{8}$/) });

export async function GET(_request: Request, context: { params: Promise<{ serial: string }> }) {
  if (isRateLimited(_request, "device-detail")) return rateLimitedResponse();
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "Nomor serial tidak valid." }, { status: 400 });
  if (!DEVICES.some((device) => device.serial === params.data.serial)) {
    return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  }
  try {
    const device = (await listDevices()).find((item) => item.serial === params.data.serial);
    if (!device) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ mode: process.env.DEMO_MODE === "false" ? "real" : "demo", device }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/devices/[serial] failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Detail perangkat tidak dapat dimuat." }, { status: 503 });
  }
}
