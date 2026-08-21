"use client";

import {
  Activity,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  computePnl,
  computeWinRate,
  formatPrice,
  useExpertStore,
} from "@/lib/expert-store";

export default function StatsCards() {
  const profile = useExpertStore((s) => s.profile);
  const history = useExpertStore((s) => s.history);
  const botRunning = useExpertStore((s) => s.botRunning);
  const botStats = useExpertStore((s) => s.botStats);

  const balance = profile?.balance ?? 0;
  const currency = profile?.currency ?? "USD";
  const { rate, wins, losses } = computeWinRate(history);
  const totalPnl = computePnl(history);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Balance */}
      <Card className="bg-card/40 border-white/10 py-4 gap-2">
        <div className="px-4 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">الرصيد</span>
          <Wallet className="size-3.5 text-emerald-400" />
        </div>
        <div className="px-4">
          <div className="font-mono text-xl font-bold text-zinc-100">
            {formatPrice(balance, 2)}
          </div>
          <div className="text-[10px] text-zinc-500">{currency}</div>
        </div>
      </Card>

      {/* Win rate */}
      <Card className="bg-card/40 border-white/10 py-4 gap-2">
        <div className="px-4 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">معدل الربح</span>
          <Percent className="size-3.5 text-violet-400" />
        </div>
        <div className="px-4">
          <div className="font-mono text-xl font-bold text-zinc-100">
            {rate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-zinc-500">
            <span className="text-emerald-400">{wins} ربح</span>
            {" / "}
            <span className="text-red-400">{losses} خسارة</span>
          </div>
        </div>
      </Card>

      {/* Net PnL */}
      <Card className="bg-card/40 border-white/10 py-4 gap-2">
        <div className="px-4 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">صافي الربح/الخسارة</span>
          {totalPnl >= 0 ? (
            <TrendingUp className="size-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="size-3.5 text-red-400" />
          )}
        </div>
        <div className="px-4">
          <div
            className={`font-mono text-xl font-bold ${
              totalPnl > 0
                ? "text-emerald-400"
                : totalPnl < 0
                  ? "text-red-400"
                  : "text-zinc-100"
            }`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatPrice(totalPnl, 2)}
          </div>
          <div className="text-[10px] text-zinc-500">
            {history.length} صفقة مغلقة
          </div>
        </div>
      </Card>

      {/* Bot status */}
      <Card className="bg-card/40 border-white/10 py-4 gap-2">
        <div className="px-4 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">حالة البوت</span>
          <Activity
            className={`size-3.5 ${botRunning ? "text-violet-400 animate-pulse" : "text-zinc-500"}`}
          />
        </div>
        <div className="px-4">
          <div
            className={`text-sm font-bold ${
              botRunning ? "text-violet-300" : "text-zinc-400"
            }`}
          >
            {botRunning ? "● يعمل" : "● متوقف"}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {botStats.tradesPlaced} صفقة |{" "}
            <span
              className={
                botStats.pnl >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {botStats.pnl >= 0 ? "+" : ""}
              {formatPrice(botStats.pnl, 2)}$
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
