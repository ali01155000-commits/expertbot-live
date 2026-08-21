"use client"

import { useBotStore, formatPrice } from "@/lib/bot-store"
import { PAIR_META } from "@/lib/bot-types"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"

export function TradeHistory() {
  const history = useBotStore((s) => s.history)

  if (history.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
        لا يوجد سجل صفقات بعد
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-72">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[11px]">الزوج</TableHead>
            <TableHead className="text-[11px]">الاتجاه</TableHead>
            <TableHead className="text-[11px]">المصدر</TableHead>
            <TableHead className="text-[11px] text-right">الرهان</TableHead>
            <TableHead className="text-[11px] text-right">النتيجة</TableHead>
            <TableHead className="text-[11px] text-right">الوقت</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((t) => {
            const meta = PAIR_META[t.pair]
            const dec = meta?.decimals ?? 5
            const won = t.status === "won"
            const lost = t.status === "lost"
            const tie = t.status === "tie"
            return (
              <TableRow key={t.id} className="text-xs">
                <TableCell className="font-medium">{meta?.label ?? t.pair}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                      t.direction === "CALL"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    )}
                  >
                    {t.direction === "CALL" ? "▲" : "▼"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.source === "bot" ? "🤖" : "✋"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(t.amount, 0)}$
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      won && "text-emerald-400",
                      lost && "text-red-400",
                      tie && "text-muted-foreground"
                    )}
                  >
                    {won && `+${formatPrice(t.profit ?? 0, 2)}`}
                    {lost && formatPrice(t.profit ?? 0, 2)}
                    {tie && "0.00"}
                  </span>
                  <div className="text-[9px] text-muted-foreground">
                    @ {formatPrice(t.exitPrice ?? 0, dec)}
                  </div>
                </TableCell>
                <TableCell className="text-right text-[10px] text-muted-foreground">
                  {t.closedAt
                    ? new Date(t.closedAt).toLocaleTimeString("ar-EG", {
                        hour12: false,
                      })
                    : "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}
