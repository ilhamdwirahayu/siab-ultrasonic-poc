"use client";

import Link from "next/link";
import { Activity, AlertCircle, ArrowUpRight, Clock3, Gauge, RefreshCw, Waves } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { MonitoringCharts } from "@/components/charts/MonitoringCharts";
import { DeviceTwin } from "@/components/digital-twin/DeviceTwin";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { TELEMETRY_PERIODS, type TelemetryPeriod } from "@/lib/telemetry/chart-data";
import type { DeviceWithLatest, Reading, Summary } from "@/types/telemetry";

interface DashboardResponse {
  mode: "demo" | "real";
  devices: DeviceWithLatest[];
}

interface SummaryResponse {
  summary: Summary;
}

interface ReadingsResponse {
  readings: Reading[];
}

export function Dashboard() {
  const [selectedSerial, setSelectedSerial] = useState("26261652");
  const [period, setPeriod] = useState<TelemetryPeriod>("24h");
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const markUpdated = useCallback(() => setLastUpdated(new Date().toISOString()), []);
  const deviceResource = useSWR<DashboardResponse>("/api/devices", fetchJson, {
    refreshInterval: 60_000,
    errorRetryInterval: 60_000,
    onSuccess: markUpdated,
  });
  const summaryResource = useSWR<SummaryResponse>("/api/summary?range=24h", fetchJson, {
    refreshInterval: 60_000,
    errorRetryInterval: 60_000,
    onSuccess: markUpdated,
  });
  const readingsKey = `/api/readings?serial=${selectedSerial}&range=${period}&limit=10000`;
  const readingsResource = useSWR<ReadingsResponse>(readingsKey, fetchJson, {
    refreshInterval: 60_000,
    errorRetryInterval: 60_000,
    onSuccess: markUpdated,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshData() {
    setSyncing(true);
    try {
      await Promise.allSettled([
        deviceResource.mutate(),
        summaryResource.mutate(),
        readingsResource.mutate(),
      ]);
    } finally {
      setSyncing(false);
    }
  }

  const devices = deviceResource.data?.devices ?? [];
  const summary = summaryResource.data?.summary ?? null;
  const readings = readingsResource.data?.readings ?? [];
  const mode = deviceResource.data?.mode ?? "unknown";
  const demo = mode === "demo";
  const selectedMeter = devices.find((device) => device.serial === selectedSerial) ?? null;
  const error = deviceResource.error?.message ?? summaryResource.error?.message ?? readingsResource.error?.message ?? null;
  const loading = !deviceResource.data && !summaryResource.data && !readingsResource.data;

  return (
    <main className="page-shell">
      <section className={`mode-banner ${demo ? "mode-demo" : mode === "real" ? "mode-real" : "mode-demo"}`}>
        <span className="mode-dot" />
        <div>
          <strong>{demo ? "MODE DEMO · FIXTURE TERVERIFIKASI" : mode === "real" ? "MODE REAL · ANTARES" : "STATUS SUMBER DATA BELUM TERSEDIA"}</strong>
          <p>{demo ? "Contoh payload historis meter 26261652 ditampilkan untuk demonstrasi. Bukan data live." : mode === "real" ? "Data yang ditampilkan berasal dari histori yang tersimpan." : "Pastikan API aplikasi merespons sebelum menginterpretasikan data."}</p>
        </div>
        <span className="banner-time">WIB · Asia/Jakarta</span>
      </section>

      <div className="page-heading">
        <div>
          <p className="eyebrow">POC ANCOL 2026 <span>•</span> WATER NETWORK INTELLIGENCE</p>
          <h1>Monitoring yang <em>lebih jernih.</em></h1>
          <p className="heading-subtitle">Pantau perangkat ultrasonik dan telemetri air dalam satu tampilan.</p>
        </div>
        <Button variant="primary" onClick={() => void refreshData()} disabled={syncing || loading}>
          <RefreshCw size={16} className={syncing ? "spin" : ""} />
          {syncing ? "Memuat ulang…" : "Refresh Data"}
        </Button>
      </div>

      {error && <div className="error-banner" role="alert"><AlertCircle size={18} />{error}</div>}
      {loading ? (
        <div className="loading-grid" aria-label="Memuat data"><div /><div /><div /><div /></div>
      ) : (
        <>
          <section className="kpi-grid" aria-label="Ringkasan">
            <article className="kpi-card">
              <span className="kpi-icon kpi-aqua"><Waves size={19} /></span>
              <span className="kpi-label">Perangkat terdaftar</span>
              <strong className="kpi-value">{summary?.deviceCount ?? 4}<small> meter</small></strong>
              <span className="kpi-note">Metadata perangkat PoC</span>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon kpi-blue"><Activity size={19} /></span>
              <span className="kpi-label">Pernah menerima data</span>
              <strong className="kpi-value">{summary?.devicesWithReadings ?? 0}<small> / {summary?.deviceCount ?? 4}</small></strong>
              <span className="kpi-note">Tidak menyatakan status online</span>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon kpi-orange"><Gauge size={19} /></span>
              <span className="kpi-label">Debit agregat terakhir</span>
              <strong className="kpi-value">{formatNumber(summary?.aggregateFlowM3PerHour)}<small> m³/jam</small></strong>
              <span className="kpi-note">Interval uplink belum dipastikan</span>
            </article>
            <article className="kpi-card">
              <span className="kpi-icon kpi-violet"><ArrowUpRight size={19} /></span>
              <span className="kpi-label">Konsumsi hari ini</span>
              <strong className="kpi-value">{summary?.dailyConsumptionM3 === null ? "—" : formatNumber(summary?.dailyConsumptionM3)}<small> m³</small></strong>
              <span className="kpi-note">{summary?.consumptionStatus === "insufficient-data" ? "Data belum cukup untuk menghitung" : summary?.consumptionStatus === "anomaly" ? "Anomali totalizer terdeteksi" : "Selisih totalizer positif"}</span>
            </article>
          </section>

          <section className="panel digital-twin-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">DIGITAL TWIN · JARINGAN DISTRIBUSI</p><h2>SIAB Ultrasonic 213E | DN15</h2></div>
              <label className="twin-meter-select"><span>Meter</span><select value={selectedSerial} onChange={(event) => setSelectedSerial(event.target.value)}>
                <option value="26261648">26261648</option>
                <option value="26261649">26261649</option>
                <option value="26261652">26261652</option>
                <option value="26261654">26261654</option>
              </select></label>
            </div>
            <DeviceTwin device={selectedMeter} />
            <p className="twin-caption">Skema konseptual jaringan air. Bentuk/ukuran komponen dan jalur distribusi bukan as-built drawing atau klaim dimensi fisik terverifikasi.</p>
          </section>

          <section className="panel telemetry-panel" aria-label="Grafik time-series meter">
            <div className="panel-heading telemetry-heading">
              <div><p className="eyebrow">LIVE TELEMETRY · ASIA/JAKARTA</p><h2>Monitoring time-series</h2></div>
              <div className="chart-controls">
                <label><span>Periode</span><select value={period} onChange={(event) => setPeriod(event.target.value as TelemetryPeriod)}>
                  {Object.keys(TELEMETRY_PERIODS).map((value) => (
                    <option key={value} value={value}>{formatPeriod(value as TelemetryPeriod)}</option>
                  ))}
                </select></label>
              </div>
            </div>
            {readingsResource.data ? (
              <MonitoringCharts readings={readings} period={period} now={now} />
            ) : (
              <div className="chart-load-state" role="status">
                {readingsResource.error
                  ? "Histori belum berhasil dimuat; aktivitas uplink tidak ditampilkan sebagai nol."
                  : "Memuat histori tersimpan…"}
              </div>
            )}
          </section>

          <section className="panel device-telemetry-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">STATUS PER PERANGKAT</p><h2>Komunikasi dan pengukuran</h2></div>
              <span className="count-pill">{devices.length} meter</span>
            </div>
            <div className="device-table-wrap">
              <table className="device-telemetry-table">
                <thead><tr><th>Perangkat</th><th>Komunikasi</th><th>Debit</th><th>Totalizer</th><th>Temperatur</th><th>Uplink terakhir</th><th>Decoder</th></tr></thead>
                <tbody>{devices.map((device) => (
                  <tr key={device.serial}>
                    <td><Link href={`/devices/${device.serial}`}>Meter {device.serial}</Link><small>{device.devEui}</small></td>
                    <td><span className={`status-pill status-${device.status}`}><span />{formatDeviceStatus(device.status)}</span></td>
                    <td>{formatMeasured(device.latest?.flowM3PerHour, "m³/jam")}</td>
                    <td>{formatMeasured(device.latest?.forwardM3, "m³")}</td>
                    <td>{formatMeasured(device.latest?.temperatureC, "°C")}</td>
                    <td>{device.lastSeen ? formatDateTime(device.lastSeen) : "—"}</td>
                    <td>{device.latest?.decodeStatus ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="inventory-footnote"><Clock3 size={14} />FRESH/STALE mengacu pada waktu uplink terakhir; status komunikasi tidak menyatakan kondisi aliran air.</p>
          </section>

          <section className="bottom-grid">
            <article className="panel latest-panel">
              <div className="panel-heading"><div><p className="eyebrow">STATUS KOMUNIKASI · HISTORI TERSIMPAN</p><h2>Uplink terakhir · meter {selectedSerial}</h2></div><span className={`status-pill status-${selectedMeter?.status ?? "no-data"}`}><span />{formatDeviceStatus(selectedMeter?.status ?? "no-data")}</span></div>
              {selectedMeter?.latest ? (
                <div className="diagnostic-content">
                  <div className="diagnostic-time"><Clock3 size={15} />Last Uplink · {formatDateTime(selectedMeter.latest.receivedAt)} WIB · decoder {selectedMeter.latest.decodeStatus}</div>
                  <div className="diagnostic-grid">
                    <Metric label="DevEUI" value={selectedMeter.latest.devEui} />
                    <Metric label="Timestamp uplink" value={formatDateTime(selectedMeter.latest.receivedAt)} />
                    <Metric label="RSSI" value={`${formatNumber(selectedMeter.latest.rssi, 0)} dBm`} />
                    <Metric label="SNR" value={`${formatNumber(selectedMeter.latest.snr)} dB`} />
                  </div>
                  <details className="raw-details">
                    <summary>Payload raw ANTARES <span>Data tersimpan</span></summary>
                    <code>{selectedMeter.latest.payloadHex}</code>
                  </details>
                </div>
              ) : <div className="empty-state">NO DATA · Belum ada uplink meter {selectedSerial} tersimpan di Supabase.</div>}
            </article>
          </section>
          <div className="refresh-note">
            <Clock3 size={14} />Pembaruan otomatis setiap 60 detik · Last Updated {formatDateTime(lastUpdated)} WIB · Last Uplink {formatDateTime(selectedMeter?.lastSeen)} WIB
          </div>
        </>
      )}
      <footer className="page-footer"><span>SIAB ULTRASONIC MONITORING <i>·</i> POC ANCOL 2026</span><span>Untuk pemantauan teknis, bukan penagihan resmi.</span></footer>
    </main>
  );
}

function formatDeviceStatus(status: DeviceWithLatest["status"]): string {
  return status === "fresh" ? "FRESH" : status === "stale" ? "STALE" : "NO DATA";
}

function formatMeasured(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? "—" : `${formatNumber(value)} ${unit}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `Backend SIAB gagal memuat data (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

function formatPeriod(period: TelemetryPeriod): string {
  if (period === "7d") return "7 hari";
  if (period === "30d") return "30 hari";
  return `${period.replace("h", "")} jam`;
}
