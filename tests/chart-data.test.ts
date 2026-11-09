import { describe, expect, it } from "vitest";
import { buildTelemetryChartData, CHART_BUCKET_MS } from "../src/lib/telemetry/chart-data";
import type { Reading } from "../src/types/telemetry";

function reading(id: string, timestamp: number, values: Partial<Reading> = {}): Reading {
  return {
    id,
    serial: "26261652",
    devEui: "8cf95720001cd395",
    receivedAt: new Date(timestamp).toISOString(),
    radioGpsTime: null,
    meterTime: null,
    forwardM3: null,
    reverseM3: null,
    flowM3PerHour: null,
    temperatureC: null,
    statusRaw: null,
    decodeStatus: "partial",
    decodeMessage: "",
    payloadHex: "",
    port: 8,
    frequencyMHz: null,
    spreadingFactor: null,
    rssi: null,
    snr: null,
    counter: null,
    source: "antares",
    ...values,
  };
}

describe("buildTelemetryChartData", () => {
  const now = Date.parse("2026-11-09T00:00:00.000Z");
  const bucketStart = Math.floor(now / CHART_BUCKET_MS) * CHART_BUCKET_MS - CHART_BUCKET_MS;

  it("fills elapsed uplink buckets with zero and keeps a zero baseline", () => {
    const data = buildTelemetryChartData([], "1h", now);
    expect(data.buckets.length).toBe(11);
    expect(data.buckets.every((bucket) => bucket.count === 0)).toBe(true);
    expect(data.buckets.every((bucket) => !bucket.hasUplink)).toBe(true);
  });

  it("counts a single uplink in its six-minute slot", () => {
    const data = buildTelemetryChartData([
      reading("/antares/cin-one", bucketStart + 10_000),
    ], "1h", now);
    expect(data.buckets.find((bucket) => bucket.timestamp === bucketStart)?.count).toBe(1);
  });

  it("counts unique ANTARES resource IDs once in each six-minute slot", () => {
    const one = reading("/antares/cin-one", bucketStart + 10_000);
    const another = reading("/antares/cin-two", bucketStart + 30_000);
    const data = buildTelemetryChartData([one, one, another], "1h", now);
    expect(data.buckets.find((bucket) => bucket.timestamp === bucketStart)?.count).toBe(2);
    expect(data.buckets.find((bucket) => bucket.timestamp === bucketStart)?.hasUplink).toBe(true);
  });

  it("keeps measurement gaps null while drawing a verified zero flow", () => {
    const data = buildTelemetryChartData([
      reading("zero-flow", bucketStart - 2 * CHART_BUCKET_MS + 20_000, { flowM3PerHour: 0 }),
      reading("unknown", bucketStart + 40_000),
      reading("invalid-negative-flow", bucketStart + 50_000, { flowM3PerHour: -0.5 }),
      reading("later-flow", bucketStart + 20_000, { flowM3PerHour: 0.5 }),
    ], "1h", now);
    expect(data.flow.map((point) => point.value)).toEqual([0, null, 0.5]);
    expect(data.hasVerifiedFlow).toBe(true);
  });

  it("builds six-minute zero buckets and preserves radio samples for 30 days", () => {
    const data = buildTelemetryChartData([
      reading("radio", now - 60_000, { rssi: -93, snr: 6.5 }),
    ], "30d", now);
    expect(data.buckets).toHaveLength(30 * 24 * 10 + 1);
    expect(data.buckets.reduce((count, bucket) => count + bucket.count, 0)).toBe(1);
    expect(data.buckets.filter((bucket) => bucket.count > 0)).toHaveLength(1);
    expect(data.rssi).toHaveLength(1);
    expect(data.snr[0].value).toBe(6.5);
  });

  it("computes consecutive totalizer differences including a measured zero", () => {
    const data = buildTelemetryChartData([
      reading("total-1", bucketStart + 10_000, { forwardM3: 12 }),
      reading("total-2", bucketStart + 20_000, { forwardM3: 12 }),
      reading("total-3", bucketStart + 30_000, { forwardM3: 15 }),
    ], "1h", now);
    expect(data.totalizer.map((point) => point.value)).toEqual([12, 12, 15]);
    expect(data.consumption.map((point) => point.value)).toEqual([0, 3]);
    expect(data.consumptionStatus).toBe("available");
  });

  it("reports insufficient totalizer data and handles a local midnight boundary", () => {
    const data = buildTelemetryChartData([
      reading("midnight-before", Date.parse("2026-11-08T16:59:00Z"), { forwardM3: 5 }),
      reading("midnight-after", Date.parse("2026-11-08T17:01:00Z"), { forwardM3: 6 }),
    ], "12h", Date.parse("2026-11-08T18:00:00Z"));
    expect(data.consumption.map((point) => point.value)).toEqual([1]);
    expect(data.consumptionStatus).toBe("available");
  });

  it("does not claim consumption without two valid totalizers", () => {
    const data = buildTelemetryChartData([
      reading("unknown-total", bucketStart + 10_000),
      reading("one-total", bucketStart + 20_000, { forwardM3: 0 }),
    ], "1h", now);
    expect(data.consumption).toEqual([]);
    expect(data.consumptionStatus).toBe("insufficient-data");
  });
});
