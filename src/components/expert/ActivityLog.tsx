"use client";

import { useEffect, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ScrollText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EMPTY_LOGS,
  useExpertStore,
} from "@/lib/expert-store";
import type { LogType } from "@/lib/expert-types";

const TYPE_META: Record<
  LogType,
  { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  info: { color: "text-sky-300", bg: "bg-sky-500/5", icon: Info },
  signal: { color: "text-violet-300", bg: "bg-violet-500/5", icon: Sparkles },
  trade: { color: "text-amber-300", bg: "bg-amber-500/5", icon: ScrollText },
  win: { color: "text-emerald-300", bg: "bg-emerald-500/5", icon: TrendingUp },
  loss: { color: "text-red-300", bg: "bg-red-500/5", icon: TrendingDown },
  warn: { color: "text-yellow-300", bg: "bg-yellow-500/5", icon: AlertTriangle },
  error: { color: "text-red-400", bg: "bg-red-500/10", icon: AlertCircle },
};

function formatTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function ActivityLog() {
  const logs = useExpertStore((s) => s.logs) ?? EMPTY_LOGS;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new logs.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ScrollText className="size-3.5 text-sky-400" />
          سجل الأحداث
        </div>
        <Badge variant="outline" className="border-white/10 text-zinc-400">
          {logs.length}
        </Badge>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 max-h-[280px] overflow-y-auto rounded-lg border border-white/10 bg-[#050709] p-2 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center text-zinc-600">
            <span>بانتظار الأحداث...</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((l, i) => {
              const meta = TYPE_META[l.type] ?? TYPE_META.info;
              const Icon = meta.icon;
              return (
                <div
                  key={`${l.time}-${i}`}
                  className={`flex items-start gap-1.5 rounded px-1 py-0.5 ${meta.bg}`}
                >
                  <span className="text-zinc-600 shrink-0">
                    {formatTime(l.time)}
                  </span>
                  <Icon className={`size-3 mt-0.5 shrink-0 ${meta.color}`} />
                  <span className={`${meta.color} break-all`}>{l.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
