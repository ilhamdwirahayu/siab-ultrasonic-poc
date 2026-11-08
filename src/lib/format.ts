export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Belum ada data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(date);
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits }).format(value);
}

export function localDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
