"use client";

import dynamic from "next/dynamic";

const WaterMeterTwin = dynamic(() => import("@/components/digital-twin/WaterMeterTwin"), {
  ssr: false,
  loading: () => <div className="twin-stage twin-loading">Memuat visualisasi 3D…</div>,
});

export function DeviceTwin({ flow }: { flow: number | null }) {
  return <WaterMeterTwin flow={flow} />;
}
