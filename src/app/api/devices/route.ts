import { NextResponse } from "next/server";
import { listDevices } from "@/lib/db/repository";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isRateLimited(request, "devices")) return rateLimitedResponse();
  try {
    const devices = await listDevices();
    return NextResponse.json({ mode: process.env.DEMO_MODE === "false" ? "real" : "demo", devices }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/devices failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Data perangkat tidak dapat dimuat." }, { status: 503 });
  }
}
