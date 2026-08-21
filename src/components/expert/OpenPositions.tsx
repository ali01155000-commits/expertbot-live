"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Clock, Inbox, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EMPTY_OPEN_TRADES,
  formatPrice,
  useExpertStore,
} from "@/lib/expert-store";

// Tick every second for countdown refresh.
function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function OpenPositions() {
  const openTrades = useExpertStore((s) => s.openTrades) ?? EMPTY_OPEN_TRADES;
  const currentPrice = useExpertStore((s) => s.currentPrice);
  const assets = useExpertStore((s) => s.assets);
  const now = useNowTick(500);

  const assetName = (id: number) =>
    assets.find((a) => a.id === id)?.name ?? `Asset #${id}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Clock className="size-3.5 text-amber-400" />
          الصفقات المفتوحة
        </div>
        <Badge variant="outline" className="border-white/10 text-zinc-400">
          {openTrades.length}
        </Badge>
      </div>

      <div className="flex-1 min-h-0">
        {openTrades.length === 0 ? (
          <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-zinc-600 rounded-lg border border-dashed border-white/10 bg-black/20">
            <Inbox className="size-5" />
            <span className="text-[11px]">لا توجد صفقات مفتوحة</span>
          </div>
        ) : (
          <ScrollArea className="h-full max-h-[420px]">
            <div className="space-y-2 pr-1">
              {openTrades.map((t) => {
                const elapsedMs = now - (t.openedAt || 0);
                const totalMs = t.expirySec * 1000;
                const remainingMs = Math.max(0, totalMs - elapsedMs);
                const progress = Math.min(100, (elapsedMs / totalMs) * 100);
                const remainingSec = Math.ceil(remainingMs / 1000);
                const isCall = t.direction === "call";

                // Winning indicator (only meaningful if entryPrice > 0)
                let winning: boolean | null = null;
                if (t.entryPrice && t.entryPrice > 0 && currentPrice != null) {
                  winning = isCall ? currentPrice > t.entryPrice : currentPrice < t.entryPrice;
                }

                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border bg-black/30 p-2.5 ${
                      winning === true
                        ? "border-emerald-500/40"
                        : winning === false
                          ? "border-red-500/40"
                          : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex size-5 items-center justify-center rounded ${
                            isCall
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {isCall ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )}
                        </span>
                        <span className="text-xs font-medium text-zinc-100">
                          {assetName(t.assetId)}
                        </span>
                        {t.source === "bot" ? (
                          <Badge
                            variant="outline"
                            className="border-violet-500/40 bg-violet-500/10 text-violet-300 text-[9px] py-0"
                          >
                            🤖 بوت
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-sky-500/40 bg-sky-500/10 text-sky-300 text-[9px] py-0"
                          >
                            ✋ يدوي
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-xs text-zinc-200">
                        ${t.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5 font-mono">
                      <span>
                        الدخول:{" "}
                        <span className="text-zinc-300">
                          {t.entryPrice > 0 ? formatPrice(t.entryPrice, 5) : "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="size-3" />
                        {remainingSec}s
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full transition-all duration-300 ${
                          winning === false
                            ? "bg-red-500"
                            : winning === true
                              ? "bg-emerald-500"
                              : isCall
                                ? "bg-emerald-500/60"
                                : "bg-red-500/60"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
