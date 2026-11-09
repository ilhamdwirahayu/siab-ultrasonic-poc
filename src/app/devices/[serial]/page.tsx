import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Radio, Waves } from "lucide-react";
import { DeviceDetailCharts } from "@/components/charts/DeviceDetailCharts";
import { DeviceTwin } from "@/components/digital-twin/DeviceTwin";
import { DEVICES } from "@/config/devices";
import { listDevices } from "@/lib/db/repository";
import { formatDateTime, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const metadata = DEVICES.find((device) => device.serial === serial);
  if (!metadata) notFound();
  const device = (await listDevices()).find((item) => item.serial === serial);
  if (!device) notFound();
  const latest = device.latest;

  return (
    <main className="page-shell detail-shell">
      <Link href="/" className="back-link"><ArrowLeft size={16} />Kembali ke dashboard</Link>
      <div className="page-heading detail-heading">
        <div>
          <p className="eyebrow">DETAIL PERANGKAT <span>•</span> ZHONGPEI 213E</p>
          <h1>Meter <em>{serial}</em></h1>
          <p className="heading-subtitle">{metadata.location}</p>
        </div>
        <span className={`status-pill status-${device.status}`}><span />{device.status === "fresh" ? "FRESH" : device.status === "stale" ? "STALE" : "NO DATA"}</span>
      </div>
      <section className="detail-grid">
        <article className="panel detail-tech">
          <div className="panel-heading"><div><p className="eyebrow">IDENTITAS METER</p><h2><Waves size={19} />Parameter tetap</h2></div></div>
          <div className="tech-table">
            <TechRow label="Serial meter" value={metadata.serial} />
            <TechRow label="DevEUI" value={metadata.devEui} />
            <TechRow label="Diameter nominal (DN)" value={metadata.dn} />
            <TechRow label="Q3" value={`${metadata.q3M3PerHour} m³/jam`} />
            <TechRow label="Lokasi" value={metadata.location} />
            <TechRow label="Interval uplink" value={metadata.expectedIntervalMinutes ? `${metadata.expectedIntervalMinutes} menit` : "Belum diketahui"} />
            <TechRow label="Terakhir diterima" value={formatDateTime(device.lastSeen)} />
            <TechRow label="Total volume (forward)" value={`${formatNumber(latest?.forwardM3 ?? null)} m³`} />
            <TechRow label="Debit" value={`${formatNumber(latest?.flowM3PerHour ?? null)} m³/jam`} />
            <TechRow label="RSSI / SNR" value={`${formatNumber(latest?.rssi ?? null, 0)} dBm / ${formatNumber(latest?.snr ?? null)} dB`} />
          </div>
        </article>
        <article className="panel detail-twin">
          <div className="panel-heading"><div><p className="eyebrow">DIGITAL TWIN</p><h2>Ilustrasi meter</h2></div></div>
          <DeviceTwin device={device} refreshDevice />
        </article>
      </section>
      <DeviceDetailCharts serial={serial} />
      <section className="bottom-grid detail-bottom">
        <article className="panel latest-panel">
          <div className="panel-heading"><div><p className="eyebrow">LORAWAN DIAGNOSTICS</p><h2><Radio size={18} />Informasi uplink</h2></div></div>
          {latest ? (
            <div className="diagnostic-content">
              <div className="diagnostic-grid">
                <Metric label="Waktu diterima (WIB)" value={formatDateTime(latest.receivedAt)} />
                <Metric label="Radio GPS time" value={formatDateTime(latest.radioGpsTime)} />
                <Metric label="Channel / frequency" value={latest.frequencyMHz === null ? "—" : `${latest.frequencyMHz} MHz`} />
                <Metric label="FPort" value={formatNumber(latest.port, 0)} />
                <Metric label="Spreading factor" value={formatNumber(latest.spreadingFactor, 0)} />
                <Metric label="RSSI / SNR" value={`${formatNumber(latest.rssi, 0)} dBm / ${formatNumber(latest.snr)} dB`} />
              </div>
              <details className="raw-details"><summary>Payload raw & status decoding <span>Debug</span></summary><code>{latest.payloadHex}</code><p>{latest.decodeMessage}</p></details>
              <p className="decode-status">Status decoding: <strong>{latest.decodeStatus}</strong></p>
            </div>
          ) : <div className="empty-state">Belum ada uplink untuk serial ini.</div>}
        </article>
      </section>
      <p className="caution-note">DN15 adalah metadata nominal meter; bukan ukuran OD pipa existing pelanggan. Nilai belum diverifikasi tidak ditampilkan sebagai pengukuran resmi.</p>
    </main>
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return <div className="tech-row"><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
