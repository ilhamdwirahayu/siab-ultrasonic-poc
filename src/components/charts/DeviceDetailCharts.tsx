"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { MonitoringCharts } from "@/components/charts/MonitoringCharts";
import { TELEMETRY_PERIODS, type TelemetryPeriod } from "@/lib/telemetry/chart-data";
import type { Reading } from "@/types/telemetry";

export function DeviceDetailCharts({ serial }: { serial: string }) {
  const [period, setPeriod] = useState<TelemetryPeriod>("24h");
  const [now, setNow] = useState(() => Date.now());
  const resource = useSWR<{ readings: Reading[] }>(
    `/api/readings?serial=${serial}&range=${period}&limit=10000`,
    fetchReadings,
    { refreshInterval: 60_000, errorRetryInterval: 60_000 },
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="panel telemetry-panel">
      <div className="panel-heading telemetry-heading">
        <div><p className="eyebrow">HISTORI TELEMETRI · ASIA/JAKARTA</p><h2>Monitoring time-series · Meter {serial}</h2></div>
        <label className="chart-period-select"><span>Periode</span><select value={period} onChange={(event) => setPeriod(event.target.value as TelemetryPeriod)}>
          {Object.keys(TELEMETRY_PERIODS).map((value) => (
            <option key={value} value={value}>{formatPeriod(value as TelemetryPeriod)}</option>
          ))}
        </select></label>
      </div>
      {resource.data
        ? <MonitoringCharts readings={resource.data.readings} period={period} now={now} />
        : <div className="chart-load-state" role="status">{resource.error
          ? "Histori meter tidak dapat dimuat; nilai uplink tidak ditampilkan sebagai nol."
          : "Memuat histori tersimpan…"}</div>}
    </section>
  );
}

async function fetchReadings(url: string): Promise<{ readings: Reading[] }> {
  const response = await fetch(url, { cache: "no-store" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `Histori meter tidak dapat dimuat (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!body || typeof body !== "object" || !("readings" in body) || !Array.isArray(body.readings)) {
    throw new Error("Respons histori meter tidak valid.");
  }
  return body as { readings: Reading[] };
}

function formatPeriod(period: TelemetryPeriod): string {
  if (period === "7d") return "7 hari";
  if (period === "30d") return "30 hari";
  return `${period.replace("h", "")} jam`;
}
