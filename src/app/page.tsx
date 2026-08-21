"use client";

import { ShieldAlert } from "lucide-react";

import ActivityLog from "@/components/expert/ActivityLog";
import AssetSelector from "@/components/expert/AssetSelector";
import BotControlPanel from "@/components/expert/BotControlPanel";
import CandlestickChart from "@/components/expert/CandlestickChart";
import DashboardHeader from "@/components/expert/DashboardHeader";
import ExpertSocket from "@/components/expert/ExpertSocket";
import LoginScreen from "@/components/expert/LoginScreen";
import OpenPositions from "@/components/expert/OpenPositions";
import StatsCards from "@/components/expert/StatsCards";
import TradeHistory from "@/components/expert/TradeHistory";
import { useExpertStore } from "@/lib/expert-store";

export default function Home() {
  const connected = useExpertStore((s) => s.connected);

  if (!connected) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0e14] text-zinc-100">
      {/* Invisible lifecycle component */}
      <ExpertSocket />

      <DashboardHeader />

      {/* Risk banner */}
      <div className="border-b border-amber-500/20 bg-amber-500/[0.07] px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] text-amber-200/90">
          <ShieldAlert className="size-3.5 shrink-0 text-amber-400" />
          <span>
            متصل بمنصة <strong>Expert Option الحقيقية</strong> — التداول بأموال
            فعلية إن اخترت حساباً حقيقياً. أنت تتحمل كامل المسؤولية.
          </span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Stats */}
        <StatsCards />

        {/* 3-column grid (desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
          {/* Left column: Asset selector */}
          <aside className="space-y-4">
            <section className="rounded-xl border border-white/10 bg-card/40 p-3 backdrop-blur-sm">
              <h2 className="text-xs font-semibold text-zinc-300 mb-2 px-1">
                اختيار الأصل
              </h2>
              <AssetSelector />
            </section>
          </aside>

          {/* Center column: Chart + Bot control + History */}
          <section className="space-y-4 min-w-0">
            <div className="rounded-xl border border-white/10 bg-card/40 p-3 backdrop-blur-sm h-[400px]">
              <CandlestickChart />
            </div>
            <div className="rounded-xl border border-white/10 bg-card/40 p-4 backdrop-blur-sm">
              <h2 className="text-xs font-semibold text-zinc-300 mb-3">
                لوحة تحكم البوت
              </h2>
              <BotControlPanel />
            </div>
            <div className="rounded-xl border border-white/10 bg-card/40 p-3 backdrop-blur-sm">
              <h2 className="text-xs font-semibold text-zinc-300 mb-2 px-1">
                سجل الصفقات المغلقة
              </h2>
              <TradeHistory />
            </div>
          </section>

          {/* Right column: Open positions + Activity log */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-card/40 p-3 backdrop-blur-sm h-[360px]">
              <OpenPositions />
            </div>
            <div className="rounded-xl border border-white/10 bg-card/40 p-3 backdrop-blur-sm h-[340px]">
              <ActivityLog />
            </div>
          </aside>
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#070b11] px-4 py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">ExpertBot Live</span>
            <span>— بوت تداول آلي لـ Expert Option</span>
          </div>
          <div className="flex items-center gap-3">
            <span>اتصل بخوادم حقيقية • مخاطر مالية عالية</span>
            <span className="text-zinc-700">•</span>
            <span>استخدم الحساب التجريبي أولاً</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
