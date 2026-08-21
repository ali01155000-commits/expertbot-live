"use client"

import { useBotStore } from "@/lib/bot-store"
import { Card } from "@/components/ui/card"
import { Wallet, Target, TrendingUp, Bot } from "lucide-react"
import { cn } from "@/lib/utils"

export function StatsCards() {
  const account = useBotStore((s) => s.account)
  const history = useBotStore((s) => s.history)
  const botRunning = useBotStore((s) => s.botRunning)
  const botTradesCount = useBotStore((s) => s.botTradesCount)

  const closed = history.filter((t) => t.status !== "open")
  const wins = closed.filter((t) => t.status === "won").length
  const losses = closed.filter((t) => t.status === "lost").length
  const winRate = closed.length ? (wins / closed.length) * 100 : 0
  const pnl = closed.reduce((sum, t) => sum + (t.profit ?? 0), 0)
  const botPnl = closed
    .filter((t) => t.source === "bot")
    .reduce((sum, t) => sum + (t.profit ?? 0), 0)

  const cards = [
    {
      label: "الرصيد",
      value: `${(account?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`,
      icon: Wallet,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "معدل الربح",
      value: `${winRate.toFixed(1)}%`,
      sub: `${wins}فوز / ${losses}خسارة`,
      icon: Target,
      color: winRate >= 50 ? "text-emerald-400" : "text-red-400",
      bg: winRate >= 50 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "صافي الربح/الخسارة",
      value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} $`,
      icon: TrendingUp,
      color: pnl >= 0 ? "text-emerald-400" : "text-red-400",
      bg: pnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "حالة البوت",
      value: botRunning ? "يعمل الآن" : "متوقف",
      sub: botRunning
        ? `${botTradesCount} صفقة · ${botPnl >= 0 ? "+" : ""}${botPnl.toFixed(2)}$`
        : "جاهز للتشغيل",
      icon: Bot,
      color: botRunning ? "text-emerald-400" : "text-muted-foreground",
      bg: botRunning ? "bg-emerald-500/10" : "bg-muted",
      pulse: botRunning,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => (
        <Card
          key={i}
          className="relative overflow-hidden border-white/10 bg-card/60 p-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
              <span className={cn("mt-1 font-mono text-lg font-bold", c.color)}>
                {c.value}
              </span>
              {c.sub && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {c.sub}
                </span>
              )}
            </div>
            <div className={cn("rounded-md p-1.5", c.bg)}>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
          </div>
          {c.pulse && (
            <span className="absolute right-2 top-2 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          )}
        </Card>
      ))}
    </div>
  )
}
