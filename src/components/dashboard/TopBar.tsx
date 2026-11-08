import Link from "next/link";
import { Activity, FileText, Waves } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

export function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="SIAB Ultrasonic Monitoring - beranda">
        <span className="brand-icon"><Waves size={21} /></span>
        <span><strong>SIAB</strong><small>ULTRASONIC MONITORING</small></span>
      </Link>
      <nav className="main-nav" aria-label="Navigasi utama">
        <Link href="/"><Activity size={16} />Dashboard</Link>
        <Link href="/report"><FileText size={16} />Laporan</Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}
