import { NextResponse } from "next/server";
import { isRateLimited, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (isRateLimited(request, "webhook", 10)) return rateLimitedResponse();
  return NextResponse.json({
    error: "Webhook dinonaktifkan sampai format notifikasi dan mekanisme autentikasi ANTARES diverifikasi.",
  }, { status: 501, headers: { "Cache-Control": "no-store" } });
}
