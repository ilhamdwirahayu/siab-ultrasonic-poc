import type { Reading } from "@/types/telemetry";

export const CHART_BUCKET_MS = 6 * 60_000;

export const TELEMETRY_PERIODS = {
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
} as const;

export type TelemetryPeriod = keyof typeof TELEMETRY_PERIODS;

export interface UplinkBucket {
  timestamp: number;
  count: number;
  hasUplink: boolean;
  flow: number | null;
  flowAt: number | null;
}

export interface MeasurementPoint {
  timestamp: number;
  value: number;
  readingId: string;
  previousTimestamp?: number;
}

export interface GappedMeasurementPoint {
  timestamp: number;
  value: number | null;
  readingId: string;
}

export interface TelemetryChartData {
  start: number;
  end: number;
  buckets: UplinkBucket[];
  flow: GappedMeasurementPoint[];
  totalizer: MeasurementPoint[];
  consumption: MeasurementPoint[];
  temperature: GappedMeasurementPoint[];
  rssi: GappedMeasurementPoint[];
  snr: GappedMeasurementPoint[];
  consumptionStatus: "insufficient-data" | "available" | "anomaly";
  hasVerifiedFlow: boolean;
  hasVerifiedTemperature: boolean;
  lastReceivedAt: string | null;
  lastMeasurementAt: string | null;
}

export function buildTelemetryChartData(
  input: Reading[],
  period: TelemetryPeriod,
  now = Date.now(),
): TelemetryChartData {
  const uniqueReadings = [...new Map(input.map((reading) => [reading.id, reading])).values()]
    .filter((reading) => Number.isFinite(Date.parse(reading.receivedAt)))
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));

  const currentBucket = Math.floor(now / CHART_BUCKET_MS) * CHART_BUCKET_MS;
  const start = Math.floor((now - TELEMETRY_PERIODS[period]) / CHART_BUCKET_MS) * CHART_BUCKET_MS;
  const buckets: UplinkBucket[] = [];
  const uplinksByBucket = new Map<number, number>();
  const flowsByBucket = new Map<number, { value: number; timestamp: number }>();
  const startIndex = Math.floor(start / CHART_BUCKET_MS);
  const currentIndex = Math.floor(currentBucket / CHART_BUCKET_MS);

  for (const reading of uniqueReadings) {
    const timestamp = Date.parse(reading.receivedAt);
    const index = Math.floor(timestamp / CHART_BUCKET_MS);
    if (index >= startIndex && index <= currentIndex) {
      uplinksByBucket.set(index, (uplinksByBucket.get(index) ?? 0) + 1);
      const previousFlow = flowsByBucket.get(index);
      if (isValidFlow(reading) && (!previousFlow || timestamp >= previousFlow.timestamp)) {
        flowsByBucket.set(index, { value: reading.flowM3PerHour, timestamp });
      }
    }
  }

  for (let index = startIndex; index <= currentIndex; index += 1) {
    const count = uplinksByBucket.get(index) ?? 0;
    const flow = flowsByBucket.get(index);
    buckets.push({
      timestamp: index * CHART_BUCKET_MS,
      count,
      hasUplink: count > 0,
      flow: flow?.value ?? null,
      flowAt: flow?.timestamp ?? null,
    });
  }

  const inRange = uniqueReadings.filter((reading) => {
    const timestamp = Date.parse(reading.receivedAt);
    return timestamp >= start && timestamp <= now;
  });
  const validFlows = inRange.filter(isValidFlow);
  const totalizerReadings = inRange.filter(isValidTotalizer);
  const temperatureReadings = inRange.filter(isValidTemperature);
  const rssiReadings = inRange.filter(isValidRssi);
  const snrReadings = inRange.filter(isValidSnr);
  const totalizer = totalizerReadings.map((reading) => ({
    timestamp: Date.parse(reading.receivedAt),
    value: reading.forwardM3,
    readingId: reading.id,
  }));
  const consumption: MeasurementPoint[] = [];
  let hasAnomaly = false;

  for (let index = 1; index < totalizerReadings.length; index += 1) {
    const previous = totalizerReadings[index - 1];
    const current = totalizerReadings[index];
    const previousValue = previous.forwardM3;
    const currentValue = current.forwardM3;
    if (previousValue === null || currentValue === null) continue;
    if (currentValue < previousValue) {
      hasAnomaly = true;
      continue;
    }
    consumption.push({
      timestamp: Date.parse(current.receivedAt),
      value: currentValue - previousValue,
      readingId: current.id,
      previousTimestamp: Date.parse(previous.receivedAt),
    });
  }

  const measurementTimes = inRange
    .filter((reading) => isValidFlow(reading) || isValidTotalizer(reading) || isValidTemperature(reading))
    .map((reading) => Date.parse(reading.receivedAt));

  return {
    start,
    end: now,
    buckets,
    flow: addGapBreaks(validFlows.map((reading) => ({
      timestamp: Date.parse(reading.receivedAt),
      value: reading.flowM3PerHour,
      readingId: reading.id,
    }))),
    totalizer,
    consumption,
    temperature: addGapBreaks(temperatureReadings.map((reading) => ({
      timestamp: Date.parse(reading.receivedAt),
      value: reading.temperatureC,
      readingId: reading.id,
    }))),
    rssi: addGapBreaks(rssiReadings.map((reading) => ({
      timestamp: Date.parse(reading.receivedAt),
      value: reading.rssi,
      readingId: reading.id,
    }))),
    snr: addGapBreaks(snrReadings.map((reading) => ({
      timestamp: Date.parse(reading.receivedAt),
      value: reading.snr,
      readingId: reading.id,
    }))),
    consumptionStatus: hasAnomaly ? "anomaly" : consumption.length ? "available" : "insufficient-data",
    hasVerifiedFlow: validFlows.length > 0,
    hasVerifiedTemperature: temperatureReadings.length > 0,
    lastReceivedAt: inRange.at(-1)?.receivedAt ?? null,
    lastMeasurementAt: measurementTimes.length
      ? new Date(Math.max(...measurementTimes)).toISOString()
      : null,
  };
}

function addGapBreaks(points: MeasurementPoint[]): GappedMeasurementPoint[] {
  const result: GappedMeasurementPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    result.push(point);
    const next = points[index + 1];
    if (!next) continue;

    const currentBucket = Math.floor(point.timestamp / CHART_BUCKET_MS);
    const nextBucket = Math.floor(next.timestamp / CHART_BUCKET_MS);
    if (nextBucket > currentBucket + 1) {
      result.push({
        timestamp: (currentBucket + 1) * CHART_BUCKET_MS,
        value: null,
        readingId: `gap-${currentBucket + 1}`,
      });
    }
  }
  return result;
}

function isValidFlow(reading: Reading): reading is Reading & { flowM3PerHour: number } {
  return typeof reading.flowM3PerHour === "number" && Number.isFinite(reading.flowM3PerHour) && reading.flowM3PerHour >= 0;
}

function isValidTotalizer(reading: Reading): reading is Reading & { forwardM3: number } {
  return typeof reading.forwardM3 === "number" && Number.isFinite(reading.forwardM3) && reading.forwardM3 >= 0;
}

function isValidTemperature(reading: Reading): reading is Reading & { temperatureC: number } {
  return typeof reading.temperatureC === "number" && Number.isFinite(reading.temperatureC);
}

function isValidRssi(reading: Reading): reading is Reading & { rssi: number } {
  return typeof reading.rssi === "number" && Number.isFinite(reading.rssi);
}

function isValidSnr(reading: Reading): reading is Reading & { snr: number } {
  return typeof reading.snr === "number" && Number.isFinite(reading.snr);
}
