"use client";

import { useState } from "react";
import {
  CandlestickChart as ChartIcon,
  History,
  Bot as BotIcon,
  ListOrdered,
  ScrollText,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { getExpertSocket, useExpertStore } from "@/lib/expert-store";
import { toast } from "sonner";

type Tab = "trade" | "bot" | "positions" | "history";

const TABS: { id: Tab; label: string; icon: typeof ChartIcon }[] = [
  { id: "trade", label: "تداول", icon: ChartIcon },
  { id: "bot", label: "البوت", icon: BotIcon },
  { id: "positions", label: "الصفقات", icon: ListOrdered },
  { id: "history", label: "السجل", icon: History },
];

export default function Home() {
  const connected = useExpertStore((s) => s.connected);
  const [tab, setTab] = useState<Tab>("trade");

  if (!connected) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0e14] text-zinc-100">
      <ExpertSocket />
      <DashboardHeader />

      {/* Risk banner (thin) */}
      <div className="border-b border-amber-500/20 bg-amber-500/[0.07] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10px] text-amber-200/90">
          <ShieldAlert className="size-3 shrink-0 text-amber-400" />
          <span>
            منصة <strong>Expert Option حقيقية</strong> — استخدم الحساب التجريبي
            أولاً. أنت تتحمل المسؤولية.
          </span>
        </div>
      </div>

      {/* Main scrollable content — padding-bottom clears the fixed bottom tab bar */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-24 lg:pb-3 lg:max-w-3xl lg:mx-auto w-full">
        {tab === "trade" && <TradeTab />}
        {tab === "bot" && <BotTab />}
        {tab === "positions" && <PositionsTab />}
        {tab === "history" && <HistoryTab />}
      </main>

      {/* Bottom tab bar (fixed on mobile, static on desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0e14]/95 backdrop-blur-xl lg:sticky lg:bottom-0">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  active
                    ? "text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-emerald-400" />
                )}
                <Icon className="size-5" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Trade — chart + asset + quick CALL/PUT                         */
/* ------------------------------------------------------------------ */
function TradeTab() {
  const selectedAssetId = useExpertStore((s) => s.selectedAssetId);
  const currentPrice = useExpertStore((s) => s.currentPrice);
  const botConfig = useExpertStore((s) => s.botConfig);
  const updateConfig = useExpertStore.getState().updateConfig;
  const profile = useExpertStore((s) => s.profile);
  const isDemo = profile?.isDemo ?? true;

  const quickTrade = (direction: "call" | "put") => {
    const socket = getExpertSocket();
    if (!socket) return;
    if (botConfig.amount <= 0) {
      toast.error("أدخل قيمة رهان صحيحة");
      return;
    }
    socket.emit("expert:manual-trade", {
      direction,
      amount: botConfig.amount,
      exptime: botConfig.exptime,
    });
    toast.success(
      `${direction === "call" ? "▲ شراء" : "▼ بيع"} — ${botConfig.amount}$ / ${botConfig.exptime}ث`,
      { description: isDemo ? "حساب تجريبي" : "حساب حقيقي ⚠️" }
    );
  };

  return (
    <div className="space-y-3">
      {/* Compact stats (2x2) */}
      <StatsCards />

      {/* Asset selector + current price */}
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-300">الأصل</h2>
          {currentPrice != null && (
            <span className="font-mono text-sm font-bold text-emerald-400">
              {currentPrice.toLocaleString("en-US", {
                minimumFractionDigits: 5,
                maximumFractionDigits: 5,
              })}
            </span>
          )}
        </div>
        <AssetSelector />
      </section>

      {/* Chart */}
      <section className="rounded-xl border border-white/10 bg-card/40 p-2">
        <CandlestickChart />
      </section>

      {/* Trade amount + expiry (compact) */}
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">
              قيمة الرهان ($)
            </label>
            <input
              type="number"
              min={1}
              value={botConfig.amount}
              onChange={(e) =>
                updateConfig({ amount: Math.max(0, Number(e.target.value)) })
              }
              className="h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">
              المدة (ثانية)
            </label>
            <div className="flex gap-1">
              {[15, 30, 60, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => updateConfig({ exptime: s })}
                  className={`h-10 flex-1 rounded-lg border text-xs font-medium transition ${
                    botConfig.exptime === s
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-black/30 text-zinc-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quick CALL / PUT buttons (big, thumb-friendly) */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => quickTrade("call")}
          className="h-16 gap-2 rounded-xl bg-emerald-500 text-base font-bold text-black shadow-[0_0_25px_-5px_rgba(16,185,129,0.7)] hover:bg-emerald-400"
        >
          <TrendingUp className="size-6" />
          شراء
          <span className="text-[10px] font-normal opacity-70">CALL</span>
        </Button>
        <Button
          onClick={() => quickTrade("put")}
          className="h-16 gap-2 rounded-xl bg-red-500 text-base font-bold text-white shadow-[0_0_25px_-5px_rgba(239,68,68,0.7)] hover:bg-red-400"
        >
          <TrendingDown className="size-6" />
          بيع
          <span className="text-[10px] font-normal opacity-80">PUT</span>
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Bot                                                            */
/* ------------------------------------------------------------------ */
function BotTab() {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <BotIcon className="size-4 text-emerald-400" />
          لوحة تحكم البوت الآلي
        </h2>
        <BotControlPanel />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Open positions                                                 */
/* ------------------------------------------------------------------ */
function PositionsTab() {
  const openTrades = useExpertStore((s) => s.openTrades);
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <ListOrdered className="size-4 text-emerald-400" />
          الصفقات المفتوحة
          <span className="text-[11px] font-normal text-zinc-500">
            ({openTrades.length})
          </span>
        </h2>
        <OpenPositions />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: History + Logs                                                 */
/* ------------------------------------------------------------------ */
function HistoryTab() {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <History className="size-4 text-emerald-400" />
          الصفقات المغلقة
        </h2>
        <TradeHistory />
      </section>
      <section className="rounded-xl border border-white/10 bg-card/40 p-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <ScrollText className="size-4 text-emerald-400" />
          سجل النشاط
        </h2>
        <ActivityLog />
      </section>
    </div>
  );
}
