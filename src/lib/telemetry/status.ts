import type { Reading } from "@/types/telemetry";

const defaultFreshnessMinutes = 60;

export function getFreshnessMinutes(): number {
  const configured = process.env.ANTARES_FRESHNESS_MINUTES;
  if (configured === undefined || configured.trim() === "") return defaultFreshnessMinutes;
  const minutes = Number(configured);
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new Error("ANTARES_FRESHNESS_MINUTES must be a positive integer.");
  }
  return minutes;
}

export function getReadingStatus(reading: Reading | null, now = Date.now()): "no-data" | "fresh" | "stale" {
  if (!reading) return "no-data";
  const receivedAt = Date.parse(reading.receivedAt);
  const age = now - receivedAt;
  return Number.isFinite(receivedAt) && age >= 0 && age <= getFreshnessMinutes() * 60_000
    ? "fresh"
    : "stale";
}
