import "server-only";
import { DEVICES } from "@/config/devices";
import { decodeZhongpeiPayload } from "@/lib/decoder/zhongpei";
import { getAntaresReadingTimestamp, normalizeAntaresEnvelope } from "@/lib/antares/normalizer";
import {
  buildLatestUrl,
  fetchAntaresJson,
} from "@/lib/antares/http";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import type { Reading } from "@/types/telemetry";
import { z } from "zod";

const maximumHistoryIds = 100_000;
const antaresIdListSchema = (application: string, serial: string) => {
  const prefix = `/antares-cse/antares-id/${application}/${serial}/cin[_-][A-Za-z0-9-]+$`;
  return z.object({
    "m2m:uril": z.array(z.string().regex(new RegExp(`^${prefix}`))).max(maximumHistoryIds),
  });
};

export async function fetchLatestForDevice(
  serial: string,
  options: { persist?: boolean; onPersist?: (inserted: boolean) => void } = {},
): Promise<Reading | null> {
  const device = DEVICES.find((item) => item.serial === serial);
  if (!device) throw new Error("Unknown device serial.");
  const baseUrl = process.env.ANTARES_API_BASE_URL ?? "https://platform.antares.id:8443";
  const application = process.env.ANTARES_APPLICATION ?? "SIAB-US-01";
  const accessKey = process.env.ANTARES_ACCESS_KEY;
  if (!accessKey || accessKey === "REPLACE_SERVER_ONLY") throw new Error("ANTARES access key is not configured.");

  const url = buildLatestUrl(baseUrl, application, serial);
  const response = await fetchAntaresJson(url, accessKey, "latest");
  const envelope = normalizeAntaresEnvelope(response);
  const content = envelope.content;
  if (content.devEui.toLowerCase() !== device.devEui) {
    throw new Error(`ANTARES DevEUI mismatch for meter ${serial}.`);
  }

  const receivedAt = getAntaresReadingTimestamp(envelope.createdAt, content.radio?.gps_time);
  const decoded = decodeZhongpeiPayload(content.data, {
    serial,
    devEui: device.devEui,
    receivedAt,
  });
  const radioGpsTime = content.radio?.gps_time ?? null;
  const reading: Reading = {
    ...decoded,
    id: envelope.resourceId ?? `${device.devEui}:${content.data.toLowerCase()}:${radioGpsTime ?? content.counter ?? "unknown"}`,
    radioGpsTime,
    port: content.port,
    frequencyMHz: content.radio?.freq ?? null,
    spreadingFactor: content.radio?.modulation?.spreading ?? null,
    rssi: content.radio?.hardware?.rssi ?? null,
    snr: content.radio?.hardware?.snr ?? null,
    counter: content.counter ?? null,
    source: "antares",
  };
  if (options.persist !== false) {
    const inserted = await persistReading(reading, envelope.rawResponse);
    options.onPersist?.(inserted);
  }
  return reading;
}

export async function backfillDevice(serial: string): Promise<{
  fetched: number;
  inserted: number;
  duplicates: number;
  failed: number;
  truncated: boolean;
}> {
  const device = DEVICES.find((item) => item.serial === serial);
  if (!device) throw new Error("Unknown device serial.");
  const { baseUrl, application, accessKey } = getAntaresSettings();
  const listUrl = `${baseUrl}/~/antares-cse/antares-id/${encodeURIComponent(application)}/${encodeURIComponent(serial)}?fu=1&ty=4&drt=1`;
  const rawList = await fetchAntaresJson(listUrl, accessKey, "history ID list");
  const ids = antaresIdListSchema(application, serial).parse(rawList)["m2m:uril"];
  const selectedIds = ids;
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;

  for (let index = 0; index < selectedIds.length; index += 5) {
    const batch = selectedIds.slice(index, index + 5);
    const outcomes = await Promise.allSettled(batch.map(async (resourcePath) => {
      const uri = new URL(`${baseUrl}/~${resourcePath}`);
      if (uri.origin !== new URL(baseUrl).origin) throw new Error("Invalid ANTARES resource origin.");
      const envelope = normalizeAntaresEnvelope(await fetchAntaresJson(uri.toString(), accessKey, "history item"));
      if (envelope.content.devEui.toLowerCase() !== device.devEui) {
        throw new Error("ANTARES DevEUI mismatch in history item.");
      }
      const receivedAt = getAntaresReadingTimestamp(envelope.createdAt, envelope.content.radio?.gps_time);
      const decoded = decodeZhongpeiPayload(envelope.content.data, {
        serial,
        devEui: device.devEui,
        receivedAt,
      });
      const reading: Reading = {
        ...decoded,
        id: envelope.resourceId ?? resourcePath,
        radioGpsTime: envelope.content.radio?.gps_time ?? null,
        port: envelope.content.port,
        frequencyMHz: envelope.content.radio?.freq ?? null,
        spreadingFactor: envelope.content.radio?.modulation?.spreading ?? null,
        rssi: envelope.content.radio?.hardware?.rssi ?? null,
        snr: envelope.content.radio?.hardware?.snr ?? null,
        counter: envelope.content.counter ?? null,
        source: "antares",
      };
      const wasInserted = await persistReading(reading, envelope.rawResponse);
      if (wasInserted) inserted += 1;
      else duplicates += 1;
    }));
    failed += outcomes.filter((outcome) => outcome.status === "rejected").length;
  }

  return {
    fetched: ids.length,
    inserted,
    duplicates,
    failed,
    truncated: ids.length >= maximumHistoryIds,
  };
}

async function persistReading(reading: Reading, rawAntaresResponse: unknown): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server credentials are not configured.");
  if (!reading.id.startsWith("/antares-cse/")) {
    throw new Error("ANTARES resource ID is missing; refusing to store a non-deduplicated reading.");
  }
  const { data, error } = await supabase.from("telemetry_readings").upsert({
    id: reading.id,
    serial: reading.serial,
    dev_eui: reading.devEui,
    received_at: reading.receivedAt,
    radio_gps_time: reading.radioGpsTime,
    meter_time: reading.meterTime,
    forward_m3: reading.forwardM3,
    reverse_m3: reading.reverseM3,
    flow_m3_per_hour: reading.flowM3PerHour,
    temperature_c: reading.temperatureC,
    status_raw: reading.statusRaw,
    decode_status: reading.decodeStatus,
    decode_message: reading.decodeMessage,
    payload_hex: reading.payloadHex,
    port: reading.port,
    frequency_mhz: reading.frequencyMHz,
    spreading_factor: reading.spreadingFactor,
    rssi: reading.rssi,
    snr: reading.snr,
    counter: reading.counter,
    antares_response: rawAntaresResponse,
  }, { onConflict: "id", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`Database write failed: ${error.message}`);
  return Boolean(data?.length);
}

export async function writeSyncLog(input: {
  operation: "latest" | "backfill";
  meterSerial: string;
  status: "success" | "partial" | "failed";
  fetched: number;
  inserted: number;
  duplicates: number;
  failed: number;
  startedAt: string;
  errorMessage: string | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase server credentials are not configured.");
  const { error } = await supabase.from("sync_logs").insert({
    operation: input.operation,
    meter_serial: input.meterSerial,
    status: input.status,
    fetched_count: input.fetched,
    inserted_count: input.inserted,
    duplicate_count: input.duplicates,
    failed_count: input.failed,
    started_at: input.startedAt,
    error_message: input.errorMessage,
  });
  if (error) throw new Error(`Sync log write failed: ${error.message}`);
}

function getAntaresSettings() {
  const baseUrl = (process.env.ANTARES_API_BASE_URL ?? "https://platform.antares.id:8443").replace(/\/$/, "");
  const application = process.env.ANTARES_APPLICATION ?? "SIAB-US-01";
  const accessKey = process.env.ANTARES_ACCESS_KEY;
  if (!accessKey || accessKey === "REPLACE_SERVER_ONLY") throw new Error("ANTARES access key is not configured.");
  return { baseUrl, application, accessKey };
}
