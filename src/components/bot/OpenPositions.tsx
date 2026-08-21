"use client"

import * as React from "react"
import { useBotStore, formatPrice } from "@/lib/bot-store"
import { PAIR_META } from "@/lib/bot-types"
import { cn } from "@/lib/utils"
import { Timer } from "lucide-react"

export function OpenPositions() {
  const openTrades = useBotStore((s) => s.openTrades)
  const pairs = useBotStore((s) => s.pairs)

  if (openTrades.length === 0) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <Timer className="h-5 w-5 opacity-50" />
        <span>لا توجد صفقات مفتوحة</span>
      </div>
    )
  }

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pl-1 pr-1">
      {openTrades.map((t) => {
        const meta = PAIR_META[t.pair]
        const dec = meta?.decimals ?? pairs[t.pair]?.decimals ?? 5
        const isCall = t.direction === "CALL"
        const opened = new Date(t.openedAt).getTime()
        const expiry = t.expirySec * 1000
        const elapsed = Date.now() - opened
        const remaining = Math.max(0, expiry - elapsed)
        const pct = Math.min(100, (elapsed / expiry) * 100)
        const secs = Math.ceil(remaining / 1000)
        const cur = pairs[t.pair]?.price
        const winning =
          cur != null &&
          ((isCall && cur > t.entryPrice) || (!isCall && cur < t.entryPrice))

        return (
          <div
            key={t.id}
            className="rounded-md border border-white/10 bg-card/60 p-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                    isCall
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {isCall ? "▲" : "▼"}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">{meta?.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.source === "bot" ? "🤖 بوت" : "✋ يدوي"}
                    {t.strategy ? ` · ${t.strategy}` : ""}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs font-bold">
                  {formatPrice(t.amount, 0)}$
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    winning ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {winning ? "رابحة الآن" : "خاسرة الآن"}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>دخول: {formatPrice(t.entryPrice, dec)}</span>
              <span>الحالي: {cur ? formatPrice(cur, dec) : "—"}</span>
            </div>

            <div className="mt-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    winning ? "bg-emerald-500" : "bg-red-500"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  المدة: {t.expirySec}ث
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] font-bold",
                    secs <= 5 ? "text-red-400" : "text-foreground"
                  )}
                >
                  {secs}ث
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
