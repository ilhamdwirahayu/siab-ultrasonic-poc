import type { DecodeStatus, Reading } from "@/types/telemetry";

export const METER_52_FIXTURE =
  "681052162626000000811e921f672c000000002c000000003500000000203100185116081126204002e116";

function decodeFailure(message: string): Pick<Reading, "decodeStatus" | "decodeMessage"> {
  return { decodeStatus: "error", decodeMessage: message };
}

export function decodeZhongpeiPayload(
  payload: string,
  identity: { serial: string; devEui: string; receivedAt: string },
): Omit<Reading, "id" | "source" | "radioGpsTime" | "port" | "frequencyMHz" | "spreadingFactor" | "rssi" | "snr" | "counter"> {
  const normalized = payload.trim().toLowerCase();
  const base = {
    serial: identity.serial,
    devEui: identity.devEui.toLowerCase(),
    receivedAt: identity.receivedAt,
    meterTime: null,
    forwardM3: null,
    reverseM3: null,
    flowM3PerHour: null,
    temperatureC: null,
    statusRaw: null,
    payloadHex: normalized,
  };

  if (!/^(?:[0-9a-f]{2})+$/.test(normalized)) {
    return { ...base, ...decodeFailure("Payload harus berupa HEX genap.") };
  }

  const bytes = normalized.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];
  if (bytes.length !== 43) {
    return { ...base, ...decodeFailure(`Panjang frame tidak sesuai sampel tervalidasi (${bytes.length} byte).`) };
  }
  if (bytes[0] !== 0x68 || bytes[42] !== 0x16 || bytes[10] !== 0x1e) {
    return { ...base, ...decodeFailure("Header, panjang, atau terminator frame tidak cocok dengan sampel.") };
  }

  const checksum = bytes.slice(0, 41).reduce((sum, byte) => (sum + byte) & 0xff, 0);
  if (checksum !== bytes[41]) {
    return { ...base, ...decodeFailure("Checksum aditif tidak valid.") };
  }

  return {
    ...base,
    decodeStatus: "partial",
    decodeMessage: "Struktur frame lolos validasi; field pengukuran belum diverifikasi tanpa dokumen protokol vendor.",
  };
}

export function isDecodeStatus(value: string): value is DecodeStatus {
  return value === "decoded" || value === "partial" || value === "error";
}
