"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  buildTelemetryChartData,
  CHART_BUCKET_MS,
  type GappedMeasurementPoint,
  type TelemetryPeriod,
} from "@/lib/telemetry/chart-data";
import type { Reading } from "@/types/telemetry";

type GridCoordinatesInput = Parameters<
  NonNullable<ComponentProps<typeof CartesianGrid>["verticalCoordinatesGenerator"]>
>[0];

type SeriesName = "Debit" | "Totalizer" | "Konsumsi" | "Temperatur" | "RSSI" | "SNR";

const periodTickSize: Record<TelemetryPeriod, number> = {
  "1h": 6 * 60_000,
  "6h": 30 * 60_000,
  "12h": 60 * 60_000,
  "24h": 2 * 60 * 60_000,
  "7d": 6 * 60 * 60_000,
  "30d": 24 * 60 * 60_000,
};

const seriesStyle: Record<SeriesName, { color: string; unit: string; legend: string }> = {
  Debit: { color: "#0D9488", unit: "m³/jam", legend: "" },
  Totalizer: { color: "#1976D2", unit: "m³", legend: "legend-blue" },
  Konsumsi: { color: "#8B6FD1", unit: "m³", legend: "legend-violet" },
  Temperatur: { color: "#E39437", unit: "°C", legend: "legend-amber" },
  RSSI: { color: "#5680D8", unit: "dBm", legend: "legend-blue" },
  SNR: { color: "#C26A9A", unit: "dB", legend: "legend-violet" },
};

export function MonitoringCharts({
  readings,
  period,
  now,
}: {
  readings: Reading[];
  period: TelemetryPeriod;
  now: number;
}) {
  const data = buildTelemetryChartData(readings, period, now);
  const ticks = getTicks(data.start, data.end, period);
  const received = data.lastReceivedAt ? formatDateTime(data.lastReceivedAt) : "—";
  const measured = data.lastMeasurementAt ? formatDateTime(data.lastMeasurementAt) : "—";
  const decoderPending = readings.some((reading) => reading.decodeStatus !== "decoded");

  return (
    <div className="monitoring-section">
      <div className="chart-data-status" aria-label="Waktu histori">
        <span><i className="status-dot status-dot-blue" />Pengukuran terakhir <strong>{measured} WIB</strong></span>
        <span><i className="status-dot status-dot-orange" />Uplink diterima <strong>{received} WIB</strong></span>
        {decoderPending && <span className="decoder-pending">Decoder pending · field yang belum tervalidasi tidak diplot</span>}
      </div>
      <div className="monitoring-chart-grid">
        <ChartCard title="Aktivitas Uplink" subtitle="Paket ANTARES per bucket 6 menit" color="#E39437" legend="Paket" status="Bucket lampau tanpa paket bernilai 0; setiap titik berasal dari resource ANTARES unik.">
          <LineChart data={data.buckets} margin={chartMargin}>
            <ChartGrid buckets={data.buckets} />
            <TimeAxis start={data.start} end={data.end} ticks={ticks} period={period} />
            <YAxis domain={[0, "auto"]} allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
            <ChartTooltip period={period} name="Uplink" unit="paket" integer />
            {data.buckets.filter((bucket) => bucket.hasUplink).map((bucket) => (
              <ReferenceArea
                key={bucket.timestamp}
                x1={bucket.timestamp}
                x2={bucket.timestamp + CHART_BUCKET_MS}
                fill="#E39437"
                fillOpacity={0.14}
                strokeOpacity={0}
              />
            ))}
            <ReferenceLine x={now} stroke="var(--muted)" strokeDasharray="3 4" label={nowLabel} />
            <Line
              type="stepAfter"
              dataKey="count"
              name="Uplink"
              stroke="#E39437"
              strokeWidth={2.25}
              dot={period === "30d" ? false : { r: 2.2, fill: "#E39437", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#E39437" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartCard>

        <ChartCard
          title="Debit Sesaat"
          subtitle="Debit terverifikasi · m³/jam"
          color={seriesStyle.Debit.color}
          legend={seriesStyle.Debit.unit}
          status={data.hasVerifiedFlow ? "Nilai valid saja; slot tanpa pengukuran tetap kosong." : "Belum ada data debit terverifikasi."}
          empty={!data.hasVerifiedFlow}
        >
          <MeasurementLineChart
            data={data.flow}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="Debit"
            color={seriesStyle.Debit.color}
            unit={seriesStyle.Debit.unit}
            zeroBaseline={data.hasVerifiedFlow}
            domain={[0, "auto"]}
          />
        </ChartCard>

        <ChartCard
          title="Totalizer Forward"
          subtitle="Volume kumulatif terverifikasi · m³"
          color={seriesStyle.Totalizer.color}
          legend={seriesStyle.Totalizer.unit}
          status={data.totalizer.length ? "Garis stepwise hanya menghubungkan waktu pengukuran valid." : "Belum ada data totalizer terverifikasi."}
          empty={!data.totalizer.length}
        >
          <MeasurementLineChart
            data={data.totalizer}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="Totalizer"
            color={seriesStyle.Totalizer.color}
            unit={seriesStyle.Totalizer.unit}
            lineType="stepAfter"
            domain={[0, "auto"]}
          />
        </ChartCard>

        <ChartCard
          title="Konsumsi Air"
          subtitle="Selisih totalizer valid berurutan · m³"
          color={seriesStyle.Konsumsi.color}
          legend={seriesStyle.Konsumsi.unit}
          status={data.consumptionStatus === "available"
            ? "Selisih terukur dari dua totalizer valid berurutan."
            : data.consumptionStatus === "anomaly"
              ? "Reset totalizer terdeteksi; konsumsi negatif tidak ditampilkan."
              : "Belum dapat dihitung tanpa dua totalizer valid."}
          empty={!data.consumption.length}
        >
          <MeasurementScatterChart
            data={data.consumption}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="Konsumsi"
            color={seriesStyle.Konsumsi.color}
            unit={seriesStyle.Konsumsi.unit}
            zeroBaseline={data.consumption.length > 0}
          />
        </ChartCard>

        <ChartCard
          title="Temperatur Air"
          subtitle="Temperatur hasil decoder · °C"
          color={seriesStyle.Temperatur.color}
          legend={seriesStyle.Temperatur.unit}
          status={data.hasVerifiedTemperature ? "Hanya nilai temperatur yang didekode dan valid." : "Temperatur tidak tersedia · Decoder pending."}
          empty={!data.hasVerifiedTemperature}
        >
          <MeasurementLineChart
            data={data.temperature}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="Temperatur"
            color={seriesStyle.Temperatur.color}
            unit={seriesStyle.Temperatur.unit}
            domain={["auto", "auto"]}
          />
        </ChartCard>

        <ChartCard
          title="Kualitas Sinyal · RSSI"
          subtitle="Metadata radio uplink · dBm"
          color={seriesStyle.RSSI.color}
          legend={seriesStyle.RSSI.unit}
          status={data.rssi.length ? "Sampel RSSI berasal dari metadata radio." : "Belum ada metadata RSSI."}
          empty={!data.rssi.length}
        >
          <MeasurementLineChart
            data={data.rssi}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="RSSI"
            color={seriesStyle.RSSI.color}
            unit={seriesStyle.RSSI.unit}
            domain={["auto", "auto"]}
          />
        </ChartCard>

        <ChartCard
          title="Kualitas Sinyal · SNR"
          subtitle="Metadata radio uplink · dB"
          color={seriesStyle.SNR.color}
          legend={seriesStyle.SNR.unit}
          status={data.snr.length ? "Sampel SNR berasal dari metadata radio." : "Belum ada metadata SNR."}
          empty={!data.snr.length}
        >
          <MeasurementLineChart
            data={data.snr}
            buckets={data.buckets}
            period={period}
            ticks={ticks}
            start={data.start}
            end={data.end}
            now={now}
            name="SNR"
            color={seriesStyle.SNR.color}
            unit={seriesStyle.SNR.unit}
            domain={["auto", "auto"]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  color,
  legend,
  status,
  empty = false,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  legend: string;
  status: string;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="monitoring-chart-card">
      <div className="monitoring-chart-heading">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <span className="chart-legend"><i style={{ backgroundColor: color }} />{legend}</span>
      </div>
      <div className="monitoring-chart-plot monitoring-chart-wrap">
        <ChartFrame>{children}</ChartFrame>
        {empty && <div className="chart-empty-overlay">Belum ada data</div>}
      </div>
      <p className={`chart-status ${empty ? "status-unknown" : "status-known"}`} role="status">
        <span className="status-dot" style={{ backgroundColor: color }} />{status}
      </p>
    </article>
  );
}

function MeasurementLineChart({
  data,
  buckets,
  period,
  ticks,
  start,
  end,
  now,
  name,
  color,
  unit,
  lineType = "linear",
  zeroBaseline = false,
  domain = ["auto", "auto"],
}: {
  data: GappedMeasurementPoint[];
  buckets: { timestamp: number }[];
  period: TelemetryPeriod;
  ticks: number[];
  start: number;
  end: number;
  now: number;
  name: SeriesName;
  color: string;
  unit: string;
  lineType?: "linear" | "stepAfter";
  zeroBaseline?: boolean;
  domain?: [number | "auto", number | "auto"];
}) {
  return (
    <LineChart data={data} margin={chartMargin}>
      <ChartGrid buckets={buckets} />
      <TimeAxis start={start} end={end} ticks={ticks} period={period} />
      <YAxis domain={domain} tick={axisTick} axisLine={false} tickLine={false} />
      <ChartTooltip period={period} name={name} unit={unit} />
      <ReferenceLine x={now} stroke="var(--muted)" strokeDasharray="3 4" label={nowLabel} />
      {zeroBaseline && <ReferenceLine y={0} stroke={color} strokeOpacity={0.4} />}
      <Line
        type={lineType}
        dataKey="value"
        name={name}
        stroke={color}
        strokeWidth={2.5}
        dot={data.length > 250 ? false : { r: 3.5, fill: color, strokeWidth: 0 }}
        activeDot={{ r: 5, fill: color }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

function MeasurementScatterChart({
  data,
  buckets,
  period,
  ticks,
  start,
  end,
  now,
  name,
  color,
  unit,
  zeroBaseline,
}: {
  data: { timestamp: number; value: number; readingId: string }[];
  buckets: { timestamp: number }[];
  period: TelemetryPeriod;
  ticks: number[];
  start: number;
  end: number;
  now: number;
  name: SeriesName;
  color: string;
  unit: string;
  zeroBaseline: boolean;
}) {
  return (
    <ScatterChart margin={chartMargin}>
      <ChartGrid buckets={buckets} />
      <TimeAxis start={start} end={end} ticks={ticks} period={period} />
      <YAxis domain={[0, "auto"]} tick={axisTick} axisLine={false} tickLine={false} />
      <ChartTooltip period={period} name={name} unit={unit} />
      <ReferenceLine x={now} stroke="var(--muted)" strokeDasharray="3 4" label={nowLabel} />
      {zeroBaseline && <ReferenceLine y={0} stroke={color} strokeOpacity={0.4} />}
      <Scatter data={data} dataKey="value" name={name} fill={color} />
    </ScatterChart>
  );
}

function ChartGrid({ buckets }: { buckets: { timestamp: number }[] }) {
  return (
    <CartesianGrid
      stroke="var(--line)"
      strokeDasharray="2 6"
      vertical
      verticalCoordinatesGenerator={(props) => getSixMinuteGridCoordinates(props, buckets)}
    />
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
}

function ChartTooltip({
  period,
  name,
  unit,
  integer = false,
}: {
  period: TelemetryPeriod;
  name: string;
  unit: string;
  integer?: boolean;
}) {
  return (
    <Tooltip
      labelFormatter={(value) => formatWib(Number(value), period, true)}
      formatter={(value) => [`${formatNumber(typeof value === "number" ? value : null, integer ? 0 : 2)} ${unit}`, name]}
      contentStyle={tooltipStyle}
    />
  );
}

function getTicks(start: number, end: number, period: TelemetryPeriod): number[] {
  const step = periodTickSize[period];
  const first = Math.ceil(start / step) * step;
  const ticks: number[] = [];
  for (let timestamp = first; timestamp <= end; timestamp += step) ticks.push(timestamp);
  return ticks;
}

function TimeAxis({
  start,
  end,
  ticks,
  period,
}: {
  start: number;
  end: number;
  ticks: number[];
  period: TelemetryPeriod;
}) {
  return (
    <XAxis
      dataKey="timestamp"
      type="number"
      domain={[start, end]}
      ticks={ticks}
      tickFormatter={(value) => formatWib(value, period)}
      tick={{ fill: "var(--muted)", fontSize: 9 }}
      axisLine={false}
      tickLine={false}
      minTickGap={20}
    />
  );
}

function formatWib(timestamp: number, period: TelemetryPeriod, includeZone = false): string {
  if (!Number.isFinite(timestamp)) return "";
  const options: Intl.DateTimeFormatOptions = period === "7d" || period === "30d"
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  const formatted = new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: "Asia/Jakarta",
  }).format(timestamp);
  return includeZone ? `${formatted} WIB` : formatted;
}

function getSixMinuteGridCoordinates(
  { xAxis }: GridCoordinatesInput,
  buckets: { timestamp: number }[],
): number[] {
  const scale = xAxis?.scale;
  if (!scale || typeof scale.map !== "function") return [];
  return buckets
    .map(({ timestamp }) => scale.map(timestamp))
    .filter((coordinate): coordinate is number => typeof coordinate === "number" && Number.isFinite(coordinate));
}

const chartMargin = { top: 16, right: 12, bottom: 3, left: -18 };
const axisTick = { fill: "var(--muted)", fontSize: 10 };
const tooltipStyle = {
  background: "var(--panel)",
  borderColor: "var(--line)",
  borderRadius: 12,
  color: "var(--text)",
};
const nowLabel = {
  value: "SEKARANG",
  position: "insideTopRight" as const,
  fill: "var(--muted)",
  fontSize: 8,
};
