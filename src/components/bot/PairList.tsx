"use client"

import { useBotStore, formatPrice } from "@/lib/bot-store"
import { PAIR_META } from "@/lib/bot-types"
import { cn } from "@/lib/utils"

const ORDER = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "ETHUSD", "AUDUSD"]

export function PairList() {
  const pairs = useBotStore((s) => s.pairs)
  const selected = useBotStore((s) => s.selectedPair)
  const setSelected = useBotStore((s) => s.setSelectedPair)

  return (
    <div className="flex flex-col gap-1">
      <div className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
        الأزواج المتاحة
      </div>
      {ORDER.map((p) => {
        const st = pairs[p]
        const meta = PAIR_META[p]
        const up = st ? st.price >= st.prevPrice : true
        const active = selected === p
        return (
          <button
            key={p}
            onClick={() => setSelected(p)}
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2 text-right transition-colors",
              active
                ? "border-yellow-500/60 bg-yellow-500/10"
                : "border-transparent hover:bg-accent"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold">
                {meta?.icon}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{meta?.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {st ? (st.changePct >= 0 ? "+" : "") + st.changePct.toFixed(2) + "%" : "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "font-mono text-xs font-semibold tabular-nums",
                  up ? "text-emerald-400" : "text-red-400"
                )}
              >
                {st ? formatPrice(st.price, st.decimals) : "—"}
              </span>
              <span
                className={cn(
                  "h-1 w-10 rounded-full",
                  up ? "bg-emerald-500/40" : "bg-red-500/40"
                )}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
