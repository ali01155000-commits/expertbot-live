"use client";

import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EMPTY_HISTORY,
  formatPrice,
  useExpertStore,
} from "@/lib/expert-store";

function formatTime(t?: number): string {
  if (!t) return "—";
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function TradeHistory() {
  const history = useExpertStore((s) => s.history) ?? EMPTY_HISTORY;
  const assets = useExpertStore((s) => s.assets);

  const assetName = (id: number) =>
    assets.find((a) => a.id === id)?.name ?? `#${id}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <History className="size-3.5 text-emerald-400" />
          سجل الصفقات المغلقة
        </div>
        <Badge variant="outline" className="border-white/10 text-zinc-400">
          {history.length}
        </Badge>
      </div>

      <ScrollArea className="h-full max-h-[280px]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2">الأصل</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2">الاتجاه</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2">المصدر</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2 text-left">المبلغ</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2 text-left">الربح</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2 text-left">الخروج</TableHead>
              <TableHead className="text-zinc-500 text-[10px] h-7 px-2">الوقت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow className="border-transparent hover:bg-transparent">
                <TableCell colSpan={7} className="text-center text-zinc-600 text-xs py-8">
                  لا توجد صفقات مغلقة بعد
                </TableCell>
              </TableRow>
            ) : (
              history.map((t) => {
                const isCall = t.direction === "call";
                const won = t.won;
                return (
                  <TableRow
                    key={`${t.id}-${t.closedAt ?? 0}`}
                    className="border-white/5 hover:bg-white/[0.02]"
                  >
                    <TableCell className="py-1.5 px-2 text-[11px] text-zinc-300">
                      {assetName(t.assetId)}
                    </TableCell>
                    <TableCell className="py-1.5 px-2">
                      <span
                        className={`font-mono text-[11px] ${
                          isCall ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {isCall ? "▲ شراء" : "▼ بيع"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[11px]">
                      {t.source === "bot" ? "🤖" : "✋"}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-left font-mono text-[11px] text-zinc-300">
                      ${t.amount.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`py-1.5 px-2 text-left font-mono text-[11px] font-semibold ${
                        won ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {t.profit >= 0 ? "+" : ""}
                      {formatPrice(t.profit, 2)}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-left font-mono text-[11px] text-zinc-400">
                      {t.exitPrice > 0 ? formatPrice(t.exitPrice, 5) : "—"}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[10px] text-zinc-500 font-mono">
                      {formatTime(t.closedAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
