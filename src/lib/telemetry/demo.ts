import { DEVICES } from "@/config/devices";
import { decodeZhongpeiPayload, METER_52_FIXTURE } from "@/lib/decoder/zhongpei";
import type { DeviceWithLatest, Reading, Summary } from "@/types/telemetry";
import { calculateDailyConsumption } from "@/lib/telemetry/consumption";
import { getReadingStatus } from "@/lib/telemetry/status";

export function getDemoReadings(): Reading[] {
  const decoded = decodeZhongpeiPayload(METER_52_FIXTURE, {
    serial: "26261652",
    devEui: "8cf95720001cd395",
    receivedAt: "2026-11-08T09:54:10.433Z",
  });
  return [{
    ...decoded,
    id: "fixture-meter52-uplink-20261108",
    radioGpsTime: "2026-11-08T09:54:10.433Z",
    port: 8,
    frequencyMHz: 922,
    spreadingFactor: 10,
    rssi: -73,
    snr: 12.25,
    counter: 0,
    source: "demo-fixture",
  }];
}

export function getDemoDevices(readings = getDemoReadings()): DeviceWithLatest[] {
  return DEVICES.map((device) => {
    const latest = readings
      .filter((reading) => reading.serial === device.serial && reading.devEui === device.devEui)
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0] ?? null;
    return {
      ...device,
      latest,
      lastSeen: latest?.receivedAt ?? null,
      status: getReadingStatus(latest),
    };
  });
}

export function getDemoSummary(readings = getDemoReadings()): Summary {
  const consumption = calculateDailyConsumption(readings);
  return {
    deviceCount: DEVICES.length,
    devicesWithReadings: new Set(readings.map((reading) => reading.serial)).size,
    aggregateFlowM3PerHour: null,
    dailyConsumptionM3: consumption.value,
    consumptionStatus: consumption.status,
    latestReceivedAt: readings.reduce<string | null>(
      (latest, reading) => !latest || Date.parse(reading.receivedAt) > Date.parse(latest) ? reading.receivedAt : latest,
      null,
    ),
  };
}
