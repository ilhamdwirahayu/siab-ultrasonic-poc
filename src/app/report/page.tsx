"use client";

import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReadingsChart } from "@/components/charts/ReadingsChart";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { localDateKey } from "@/lib/format";
import type { DeviceWithLatest, Reading, Summary } from "@/types/telemetry";

export default function ReportPage() {
  const [date, setDate] = useState(localDateKey(new Date().toISOString()));
  const [devices, setDevices] = useState<DeviceWithLatest[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<"demo" | "real" | "unknown">("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/devices").then((response) => response.json()),
      fetch("/api/readings?range=30d&limit=500").then((response) => response.json()),
      fetch("/api/summary?range=30d").then((response) => response.json()),
    ]).then(([deviceData, readingData, summaryData]) => {
      if (deviceData.error || readingData.error || summaryData.error) throw new Error("Data laporan tidak dapat dimuat.");
      setDevices(deviceData.devices);
      setMode(deviceData.mode);
      setReadings(readingData.readings);
      setSummary(summaryData.summary);
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Terjadi kesalahan."));
  }, []);

  const chosenReadings = useMemo(() => readings.filter((reading) => localDateKey(reading.receivedAt) === date), [readings, date]);

  function exportCsv() {
    const headers = ["serial", "dev_eui", "received_at", "forward_m3", "reverse_m3", "flow_m3_per_hour", "temperature_c", "decode_status", "payload_hex"];
    const rows = chosenReadings.map((item) => [
      item.serial, item.devEui, item.receivedAt, item.forwardM3, item.reverseM3, item.flowM3PerHour,
      item.temperatureC, item.decodeStatus, item.payloadHex,
    ].map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(","));
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `siab-report-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell report-shell">
      <Link href="/" className="back-link"><ArrowLeft size={16} />Kembali ke dashboard</Link>
      <section className={`mode-banner ${mode === "real" ? "mode-real" : "mode-demo"}`}>
        <span className="mode-dot" />
        <div><strong>{mode === "demo" ? "MODE DEMO · POC, BUKAN UNTUK PENAGIHAN RESMI" : mode === "real" ? "MODE REAL · POC, BUKAN UNTUK PENAGIHAN RESMI" : "STATUS SUMBER DATA BELUM TERSEDIA"}</strong><p>{mode === "demo" ? "Contoh payload historis fixture, bukan data live." : mode === "real" ? "Data berasal dari histori yang tersimpan. Gunakan untuk evaluasi teknis." : "Pastikan API aplikasi merespons sebelum menginterpretasikan data."}</p></div>
        <span className="banner-time">Asia/Jakarta</span>
      </section>
      <div className="page-heading report-heading">
        <div><p className="eyebrow">SIAB ULTRASONIC MONITORING</p><h1>Laporan <em>monitoring.</em></h1><p className="heading-subtitle">Ringkasan operasional perangkat meter ultrasonik.</p></div>
        <div className="report-actions"><label className="date-picker">Tanggal <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><Button variant="outline" onClick={exportCsv}><Download size={16} />Ekspor CSV</Button><Button className="print-button" onClick={() => window.print()}><Printer size={16} />Simpan PDF</Button></div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <section className="kpi-grid report-kpis">
        <ReportKpi label="Perangkat" value={String(summary?.deviceCount ?? 4)} note="Terdaftar dalam PoC" />
        <ReportKpi label="Pernah menerima uplink" value={`${summary?.devicesWithReadings ?? 0} / ${summary?.deviceCount ?? 4}`} note="Bukan status online" />
        <ReportKpi label="Debit agregat tersedia" value={`${formatNumber(summary?.aggregateFlowM3PerHour)} m³/jam`} note="Interval uplink belum dipastikan" />
        <ReportKpi label="Pembacaan pada tanggal" value={String(chosenReadings.length)} note={date} />
      </section>
      <section className="panel report-table-panel">
        <div className="panel-heading"><div><p className="eyebrow">STATUS PERANGKAT</p><h2>Ikhtisar 4 meter</h2></div></div>
        <div className="table-scroll"><table><thead><tr><th>Perangkat</th><th>DevEUI</th><th>Lokasi</th><th>Status observasi</th><th>Terakhir diterima</th></tr></thead><tbody>
          {devices.map((device) => <tr key={device.serial}><td><Link href={`/devices/${device.serial}`}>{device.serial}</Link></td><td>{device.devEui}</td><td>{device.location}</td><td>{device.latest ? "Terakhir diterima" : "Belum ada data"}</td><td>{formatDateTime(device.lastSeen)}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="panel report-chart">
        <div className="panel-heading"><div><p className="eyebrow">DATA TANGGAL TERPILIH</p><h2>Debit & totalizer</h2></div></div>
        <ReadingsChart readings={chosenReadings} />
      </section>
      <section className="panel methodology">
        <div className="panel-heading"><div><p className="eyebrow">CATATAN</p><h2>Metodologi & keterbatasan</h2></div></div>
        <ul>
          <li>Konsumsi dihitung dari selisih totalizer forward yang positif pada tanggal lokal yang sama; dua titik data minimal diperlukan.</li>
          <li>Uplink yang diketahui untuk meter 26261652 adalah pengujian kering di STO Babarsari; status 0 flow atau status mentah tidak membuktikan meter rusak.</li>
          <li>Cakupan gateway dan interval pengiriman belum terukur. Perangkat tanpa data ditampilkan sebagai “Belum ada data”, bukan offline.</li>
          <li>Interpretasi payload masih parsial dan menunggu validasi dengan dokumen protokol vendor.</li>
        </ul>
      </section>
    </main>
  );
}

function ReportKpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="kpi-card"><span className="kpi-label">{label}</span><strong className="kpi-value report-kpi-value">{value}</strong><span className="kpi-note">{note}</span></article>;
}
