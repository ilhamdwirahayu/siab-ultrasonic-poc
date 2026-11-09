import "server-only";
import { DEVICES } from "@/config/devices";
import { getDemoDevices, getDemoReadings, getDemoSummary } from "@/lib/telemetry/demo";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import type { DeviceWithLatest, Reading, Summary } from "@/types/telemetry";
import { calculateDailyConsumption } from "@/lib/telemetry/consumption";
import { getReadingStatus } from "@/lib/telemetry/status";

export async function listDevices(): Promise<DeviceWithLatest[]> {
  const supabase = getSupabaseServerClient();
  if (process.env.DEMO_MODE !== "false") return getDemoDevices();
  if (!supabase) throw new Error("Supabase server credentials are not configured.");
  return Promise.all(DEVICES.map(async (device) => {
    const { data, error } = await supabase.from("telemetry_readings").select("*")
      .eq("serial", device.serial).eq("dev_eui", device.devEui)
      .order("received_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Database query failed: ${error.message}`);
    const latest = data ? mapReading(data) : null;
    return { ...device, latest, lastSeen: latest?.receivedAt ?? null, status: getReadingStatus(latest) };
  }));
}

export async function listReadings(serial?: string, limit = 100, since?: string): Promise<Reading[]> {
  const supabase = getSupabaseServerClient();
  if (process.env.DEMO_MODE !== "false") {
    return getDemoReadings()
      .filter((reading) => (!serial || reading.serial === serial) && (!since || Date.parse(reading.receivedAt) >= Date.parse(since)))
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
      .slice(0, limit);
  }
  if (!supabase) throw new Error("Supabase server credentials are not configured.");
  const maximumReadings = Math.min(Math.max(0, limit), 10_000);
  const pageSize = 1_000;
  const readings: Reading[] = [];

  for (let offset = 0; offset < maximumReadings; offset += pageSize) {
    let query = supabase.from("telemetry_readings").select("*")
      .order("received_at", { ascending: false })
      .range(offset, Math.min(offset + pageSize, maximumReadings) - 1);
    if (serial) query = query.eq("serial", serial);
    if (since) query = query.gte("received_at", since);
    const { data, error } = await query;
    if (error) throw new Error(`Database query failed: ${error.message}`);
    const page = data ?? [];
    readings.push(...page.map(mapReading));
    if (page.length < pageSize) break;
  }
  return readings;
}

export async function getSummary(): Promise<Summary> {
  const readings = await listReadings(undefined, 500);
  const devices = await listDevices();
  if (process.env.DEMO_MODE !== "false") return getDemoSummary(readings);
  const latestReadings = devices.flatMap((device) => device.latest ? [device.latest] : []);
  const consumption = calculateDailyConsumption(readings);
  const latestReceivedAt = latestReadings.reduce<string | null>(
    (latest, reading) => !latest || Date.parse(reading.receivedAt) > Date.parse(latest) ? reading.receivedAt : latest,
    null,
  );
  return {
    deviceCount: devices.length,
    devicesWithReadings: devices.filter((device) => device.latest).length,
    aggregateFlowM3PerHour: getFreshFlowTotal(devices),
    dailyConsumptionM3: consumption.value,
    consumptionStatus: consumption.status,
    latestReceivedAt,
  };
}

function getFreshFlowTotal(devices: DeviceWithLatest[]): number | null {
  const now = Date.now();
  const freshReadings = devices.flatMap((device) => {
    const reading = device.latest;
    const interval = device.expectedIntervalMinutes;
    if (!reading || interval === null || reading.flowM3PerHour === null) return [];
    const age = now - Date.parse(reading.receivedAt);
    return age >= 0 && age <= interval * 60_000 ? [reading.flowM3PerHour] : [];
  });
  return freshReadings.length
    ? freshReadings.reduce((sum, flow) => sum + flow, 0)
    : null;
}

function mapReading(row: Record<string, unknown>): Reading {
  return {
    id: String(row.id),
    serial: String(row.serial),
    devEui: String(row.dev_eui),
    receivedAt: String(row.received_at),
    radioGpsTime: nullableString(row.radio_gps_time),
    meterTime: nullableString(row.meter_time),
    forwardM3: nullableNumber(row.forward_m3),
    reverseM3: nullableNumber(row.reverse_m3),
    flowM3PerHour: nullableNumber(row.flow_m3_per_hour),
    temperatureC: nullableNumber(row.temperature_c),
    statusRaw: nullableString(row.status_raw),
    decodeStatus: row.decode_status === "decoded" || row.decode_status === "error" ? row.decode_status : "partial",
    decodeMessage: String(row.decode_message ?? ""),
    payloadHex: String(row.payload_hex),
    port: nullableNumber(row.port),
    frequencyMHz: nullableNumber(row.frequency_mhz),
    spreadingFactor: nullableNumber(row.spreading_factor),
    rssi: nullableNumber(row.rssi),
    snr: nullableNumber(row.snr),
    counter: nullableNumber(row.counter),
    source: "antares",
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
