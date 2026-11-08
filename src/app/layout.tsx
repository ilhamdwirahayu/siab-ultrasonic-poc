import type { Metadata } from "next";
import { TopBar } from "@/components/dashboard/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIAB Ultrasonic Monitoring | PoC Ancol 2026",
  description: "Dashboard pemantauan meter air ultrasonik Zhongpei 213E.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-theme="light">
      <body><TopBar />{children}</body>
    </html>
  );
}
