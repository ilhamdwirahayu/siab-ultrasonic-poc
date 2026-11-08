import type { Reading } from "@/types/telemetry";
import { localDateKey } from "@/lib/format";

export function calculateDailyConsumption(
  readings: Reading[],
  targetDate = localDateKey(new Date().toISOString()),
): { value: number | null; status: "insufficient-data" | "available" | "anomaly" } {
  const points = readings
    .filter((reading) => reading.forwardM3 !== null && localDateKey(reading.receivedAt) === targetDate)
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));

  if (points.length < 2) return { value: null, status: "insufficient-data" };
  const first = points[0].forwardM3;
  const last = points[points.length - 1].forwardM3;
  if (first === null || last === null) return { value: null, status: "insufficient-data" };
  if (last < first) return { value: null, status: "anomaly" };
  return { value: last - first, status: "available" };
}
