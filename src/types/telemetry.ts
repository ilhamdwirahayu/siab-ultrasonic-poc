export type DecodeStatus = "decoded" | "partial" | "error";

export interface Device {
  serial: string;
  devEui: string;
  dn: "DN15";
  q3M3PerHour: 2.5;
  location: string;
  expectedIntervalMinutes: number | null;
}

export interface Reading {
  id: string;
  serial: string;
  devEui: string;
  receivedAt: string;
  radioGpsTime: string | null;
  meterTime: string | null;
  forwardM3: number | null;
  reverseM3: number | null;
  flowM3PerHour: number | null;
  temperatureC: number | null;
  statusRaw: string | null;
  decodeStatus: DecodeStatus;
  decodeMessage: string;
  payloadHex: string;
  port: number | null;
  frequencyMHz: number | null;
  spreadingFactor: number | null;
  rssi: number | null;
  snr: number | null;
  counter: number | null;
  source: "demo-fixture" | "antares";
}

export interface DeviceWithLatest extends Device {
  latest: Reading | null;
  lastSeen: string | null;
  status: "no-data" | "fresh" | "stale";
}

export interface Summary {
  deviceCount: number;
  devicesWithReadings: number;
  aggregateFlowM3PerHour: number | null;
  dailyConsumptionM3: number | null;
  consumptionStatus: "insufficient-data" | "available" | "anomaly";
  latestReceivedAt: string | null;
}

export interface AntaresContent {
  type: "uplink";
  port: number;
  data: string;
  counter?: number;
  devEui: string;
  radio?: {
    gps_time?: string;
    freq?: number;
    datarate?: number;
    hardware?: { snr?: number; rssi?: number };
    modulation?: { spreading?: number };
  };
}
