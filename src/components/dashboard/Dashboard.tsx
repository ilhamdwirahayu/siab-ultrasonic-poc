"use client";

import Link from "next/link";
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Clock3, Gauge, RefreshCw, Waves } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ReadingsChart } from "@/components/charts/ReadingsChart";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DeviceWithLatest, Reading, Summary } from "@/types/telemetry";

const WaterMeterTwin = dynamic(() => import("@/components/digital-twin/WaterMeterTwin"), {
  ssr: false,
  loading: () => <div className="twin-stage twin-loading">Memuat visualisasi 3D…</div>,
});

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

interface LiveReadingResponse {
  reading: Reading;
  status: "fresh" | "stale";
}

export function Dashboard() {
  const [devices, setDevices] = useState<DeviceWithLatest[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [liveReading, setLiveReading] = useState<Reading | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveReadingResponse["status"] | null>(null);
  const [mode, setMode] = useState<"demo" | "real" | "unknown">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch("/api/devices", { cache: "no-store" }),
        fetch("/api/summary?range=24h", { cache: "no-store" }),
        fetch("/api/readings?range=7d&limit=100", { cache: "no-store" }),
      ]);
      for (const response of responses) {
        if (!response.ok) {
          const responseBody = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(responseBody?.error ?? `Backend SIAB gagal memuat data (HTTP ${response.status}).`);
        }
      }
      const [deviceData, summaryData, readingsData] = await Promise.all(responses.map((response) => response.json())) as [
        DashboardResponse, SummaryResponse, ReadingsResponse,
      ];
      setDevices(deviceData.devices);
      setMode(deviceData.mode);
      setSummary(summaryData.summary);
      setReadings(readingsData.readings);
      setError(null);
      setLastRefresh(new Date().toISOString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Terjadi kesalahan saat memuat data.";
      setError(message === "Failed to fetch"
        ? "Tidak dapat menghubungi backend SIAB. Periksa koneksi aplikasi lalu coba lagi."
        : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch("/api/antares/latest", { cache: "no-store" });
      const body = await response.json().catch(() => null) as LiveReadingResponse & { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? `ANTARES latest request failed (HTTP ${response.status}).`);
      if (!body?.reading) throw new Error("ANTARES returned no latest uplink for meter 26261652.");
      setLiveReading(body.reading);
      setLiveStatus(body.status);
      setError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ANTARES latest request failed.";
      setError(message === "Failed to fetch"
        ? "Tidak dapat menghubungi backend SIAB untuk membaca ANTARES. Coba lagi setelah koneksi pulih."
        : message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncHistory() {
    if (mode !== "real") {
      setError("Backfill memerlukan mode real dan Supabase yang sudah dikonfigurasi.");
      return;
    }
    const token = window.prompt("Masukkan token admin sinkronisasi. Token hanya digunakan untuk permintaan ini.");
    if (!token) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync?backfill=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? `Backfill backend gagal (HTTP ${response.status}).`);
      await refresh();
      setError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Backfill ANTARES gagal.";
      setError(message === "Failed to fetch"
        ? "Tidak dapat menghubungi backend SIAB untuk backfill. Coba lagi setelah koneksi pulih."
        : message);
    } finally {
      setSyncing(false);
    }
  }

  const demo = mode === "demo";
  const displayedReadings = readings.filter((reading) => reading.serial === "26261652");
  const meter52 = devices.find((device) => device.serial === "26261652");

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
        <Button variant="primary" onClick={() => void syncNow()} disabled={syncing || loading}>
          <RefreshCw size={16} className={syncing ? "spin" : ""} />
          {syncing ? "Menyinkronkan…" : "Sync Now"}
        </Button>
        {!demo && <Button variant="outline" onClick={() => void syncHistory()} disabled={syncing || loading}>
          <Activity size={16} />Backfill History
        </Button>}
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

          <section className="main-grid">
            <article className="panel device-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">INVENTARIS PERANGKAT</p><h2>Meter terdaftar</h2></div>
                <span className="count-pill">{devices.length} device</span>
              </div>
              <div className="device-list">
                {devices.map((device, index) => (
                  <Link href={`/devices/${device.serial}`} className="device-row" key={device.serial}>
                    <span className={`device-avatar avatar-${index}`}><Waves size={19} /></span>
                    <span className="device-main">
                      <strong>Meter {device.serial}</strong>
                      <small>{device.location}</small>
                      <small className="device-eui">DevEUI {device.devEui}</small>
                    </span>
                    <span className="device-right">
                      <span className={`status-pill status-${device.status}`}>
                        <span />{formatDeviceStatus(device.status)}
                      </span>
                      <small>{formatDateTime(device.lastSeen)}</small>
                    </span>
                    <ArrowDownRight className="device-chevron" size={16} />
                  </Link>
                ))}
              </div>
              <div className="inventory-footnote"><Clock3 size={14} />Interval uplink belum dipastikan; status online/offline tidak disimpulkan.</div>
            </article>

            <article className="panel twin-panel">
              <div className="panel-heading"><div><p className="eyebrow">DIGITAL TWIN</p><h2>Ultrasonic 213E</h2></div><span className="live-tag">DN15 · Q3 2.5 m³/jam</span></div>
              <WaterMeterTwin flow={meter52?.latest?.flowM3PerHour ?? null} />
              <p className="twin-caption">Model 3D berbasis primitive untuk ilustrasi. Tidak merepresentasikan kondisi fisik aktual.</p>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div><p className="eyebrow">HISTORI TELEMETRI</p><h2>Meter 26261652</h2></div><span className="chart-legend"><i /> Debit <i className="legend-blue" /> Totalizer</span></div>
              <ReadingsChart readings={displayedReadings} />
              <p className="chart-footnote">Grafik hanya memuat data yang tersedia. Satu titik tidak cukup untuk menghitung konsumsi.</p>
            </article>
            <article className="panel latest-panel">
              <div className="panel-heading"><div><p className="eyebrow">ANTARES LIVE</p><h2>Uplink terakhir · meter 26261652</h2></div>{liveStatus ? <span className={`status-pill status-${liveStatus}`}><span />{formatDeviceStatus(liveStatus)}</span> : <span className="partial-badge">Belum disinkronkan</span>}</div>
              {liveReading ? (
                <div className="diagnostic-content">
                  <div className="diagnostic-time"><Clock3 size={15} />{formatDateTime(liveReading.radioGpsTime ?? liveReading.receivedAt)}</div>
                  <div className="diagnostic-grid">
                    <Metric label="DevEUI" value={liveReading.devEui} />
                    <Metric label="Timestamp uplink" value={formatDateTime(liveReading.receivedAt)} />
                    <Metric label="RSSI" value={`${formatNumber(liveReading.rssi, 0)} dBm`} />
                    <Metric label="SNR" value={`${formatNumber(liveReading.snr)} dB`} />
                  </div>
                  <details className="raw-details">
                    <summary>Payload raw ANTARES <span>Live response</span></summary>
                    <code>{liveReading.payloadHex}</code>
                  </details>
                </div>
              ) : <div className="empty-state">Tekan Sync Now untuk membaca latest langsung dari ANTARES. Data demo tidak digunakan pada panel live ini.</div>}
            </article>
          </section>
          <div className="refresh-note"><Clock3 size={14} />Pembaruan tampilan otomatis setiap 60 detik · Terakhir dimuat {formatDateTime(lastRefresh)}</div>
        </>
      )}
      <footer className="page-footer"><span>SIAB ULTRASONIC MONITORING <i>·</i> POC ANCOL 2026</span><span>Untuk pemantauan teknis, bukan penagihan resmi.</span></footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatDeviceStatus(status: DeviceWithLatest["status"]): string {
  return status === "fresh" ? "FRESH" : status === "stale" ? "STALE" : "NO DATA";
}
