import { describe, expect, it } from "vitest";
import { calculateDailyConsumption } from "../src/lib/telemetry/consumption";
import type { Reading } from "../src/types/telemetry";

function reading(id: string, at: string, total: number): Reading {
  return {
    id, serial: "26261652", devEui: "8cf95720001cd395", receivedAt: at,
    radioGpsTime: null, meterTime: null, forwardM3: total, reverseM3: 0,
    flowM3PerHour: 0, temperatureC: null, statusRaw: null, decodeStatus: "partial",
    decodeMessage: "", payloadHex: "", port: 8, frequencyMHz: 922,
    spreadingFactor: 10, rssi: -73, snr: 12.25, counter: 1, source: "demo-fixture",
  };
}

describe("calculateDailyConsumption", () => {
  it("returns insufficient data for a single point", () => {
    expect(calculateDailyConsumption([reading("a", "2026-11-08T03:00:00Z", 5)], "2026-11-08"))
      .toEqual({ value: null, status: "insufficient-data" });
  });

  it("computes same-local-day positive totalizer difference", () => {
    const points = [reading("a", "2026-11-08T02:00:00Z", 5), reading("b", "2026-11-08T05:00:00Z", 8)];
    expect(calculateDailyConsumption(points, "2026-11-08")).toEqual({ value: 3, status: "available" });
  });

  it("flags a totalizer reset instead of returning negative consumption", () => {
    const points = [reading("a", "2026-11-08T02:00:00Z", 8), reading("b", "2026-11-08T05:00:00Z", 1)];
    expect(calculateDailyConsumption(points, "2026-11-08")).toEqual({ value: null, status: "anomaly" });
  });
});
