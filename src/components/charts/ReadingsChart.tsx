"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Reading } from "@/types/telemetry";
import { formatNumber } from "@/lib/format";

export function ReadingsChart({ readings }: { readings: Reading[] }) {
  const data = [...readings]
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
    .map((reading) => ({
      time: new Date(reading.receivedAt).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Debit: reading.flowM3PerHour,
      Totalizer: reading.forwardM3,
    }));

  if (!data.length) return <div className="empty-chart">Belum ada histori pembacaan pada rentang ini.</div>;
  return (
    <div className="chart-wrap" role="img" aria-label="Grafik debit dan totalizer pembacaan meter">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: 12, color: "var(--text)" }}
            formatter={(value) => [formatNumber(typeof value === "number" ? value : null), ""]}
          />
          <Line type="monotone" dataKey="Debit" stroke="#16a68a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a68a" }} connectNulls={false} />
          <Line type="monotone" dataKey="Totalizer" stroke="#6597f6" strokeWidth={2} dot={{ r: 4, fill: "#6597f6" }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
