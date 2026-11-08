import { NextResponse } from "next/server";
import { fetchLatestForDevice } from "@/lib/antares/client";
import { isAntaresConfigured } from "@/lib/antares/http";
import { AntaresParsingError } from "@/lib/antares/normalizer";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";
import { getReadingStatus } from "@/lib/telemetry/status";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isRateLimited(request, "antares-latest", 10)) return rateLimitedResponse();
  if (!isAntaresConfigured()) {
    return NextResponse.json({ error: "Missing ANTARES_ACCESS_KEY server configuration." }, { status: 503 });
  }

  try {
    const reading = await fetchLatestForDevice("26261652", { persist: false });
    if (!reading) {
      return NextResponse.json({ error: "ANTARES returned no latest uplink for meter 26261652." }, { status: 404 });
    }
    return NextResponse.json({ reading, status: getReadingStatus(reading) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ANTARES latest error.";
    const isParseError = error instanceof AntaresParsingError;
    const isMissingTimestamp = message.includes("no valid creation or radio timestamp");
    const isTimeout = message.toLowerCase().includes("timed out");
    const status = isParseError || isMissingTimestamp ? 502 : isTimeout ? 504 : 502;
    const safeMessage = isMissingTimestamp
      ? "ANTARES response parsing failed: creation timestamp is missing or invalid."
      : message;
    console.error("GET /api/antares/latest failed", { serial: "26261652", status, message: safeMessage });
    return NextResponse.json({ error: safeMessage }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
