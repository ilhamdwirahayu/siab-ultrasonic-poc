"use client";

import dynamic from "next/dynamic";
import useSWR from "swr";
import type { DeviceWithLatest } from "@/types/telemetry";

const WaterMeterTwin = dynamic(() => import("@/components/digital-twin/WaterMeterTwin"), {
  ssr: false,
  loading: () => <div className="twin-scene twin-loading">Menyiapkan scene engineering 3D…</div>,
});

export function DeviceTwin({ device, refreshDevice = false }: { device: DeviceWithLatest | null; refreshDevice?: boolean }) {
  const { data, error } = useSWR<{ device: DeviceWithLatest }>(
    refreshDevice && device ? `/api/devices/${device.serial}` : null,
    fetchDevice,
    {
      fallbackData: device ? { device } : undefined,
      refreshInterval: refreshDevice ? 60_000 : 0,
      errorRetryInterval: refreshDevice ? 60_000 : 0,
    },
  );
  return (
    <>
      {error && <p className="twin-data-warning" role="status">Pembaruan meter gagal; data terakhir yang tersimpan tetap ditampilkan.</p>}
      <WaterMeterTwin device={data?.device ?? device} />
    </>
  );
}

async function fetchDevice(url: string): Promise<{ device: DeviceWithLatest }> {
  const response = await fetch(url, { cache: "no-store" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `Data meter tidak dapat diperbarui (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!body || typeof body !== "object" || !("device" in body)) {
    throw new Error("Respons detail meter tidak valid.");
  }
  return body as { device: DeviceWithLatest };
}
