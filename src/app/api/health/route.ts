import { NextResponse } from "next/server";
import { normalizeAntaresLatest } from "@/lib/antares/normalizer";
import { DEVICES } from "@/config/devices";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";
import { fetchLatestAntaresResponse, isAntaresConfigured } from "@/lib/antares/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isRateLimited(request, "health", 30)) return rateLimitedResponse();
  const supabase = getSupabaseServerClient();
  let database: "connected" | "not-configured" | "error" = supabase ? "error" : "not-configured";
  if (supabase) {
    const { error } = await supabase.from("devices").select("serial", { head: true, count: "exact" });
    database = error ? "error" : "connected";
  }

  let antares: "reachable" | "not-configured" | "error" = isAntaresConfigured() ? "error" : "not-configured";
  if (isAntaresConfigured()) {
    antares = "error";
    try {
      const serial = DEVICES.find((device) => device.serial === "26261652")?.serial;
      if (!serial) throw new Error("Configured probe device is missing.");
      normalizeAntaresLatest(await fetchLatestAntaresResponse(serial));
      antares = "reachable";
    } catch (error) {
      console.error("ANTARES health probe failed", {
        serial: "26261652",
        message: error instanceof Error ? error.message : "Unknown ANTARES health error.",
      });
      antares = "error";
    }
  }

  return NextResponse.json({
    status: database === "error" || antares === "error" ? "degraded" : "ok",
    mode: process.env.DEMO_MODE === "false" ? "real" : "demo",
    database,
    antares,
    checkedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
