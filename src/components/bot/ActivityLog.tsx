"use client"

import * as React from "react"
import { useBotStore } from "@/lib/bot-store"
import { cn } from "@/lib/utils"

const TYPE_STYLES: Record<string, string> = {
  info: "text-sky-300",
  signal: "text-violet-300",
  trade: "text-amber-300",
  win: "text-emerald-400",
  loss: "text-red-400",
  warn: "text-yellow-300",
  error: "text-red-500",
}

const TYPE_ICON: Record<string, string> = {
  info: "ℹ",
  signal: "✦",
  trade: "⟶",
  win: "✓",
  loss: "✕",
  warn: "⚠",
  error: "⛔",
}

export function ActivityLog() {
  const logs = useBotStore((s) => s.logs)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        سيظهر نشاط البوت هنا…
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed"
    >
      {logs.map((l) => (
        <div key={l.id} className="flex items-start gap-2">
          <span className="shrink-0 text-muted-foreground/60">
            {new Date(l.time).toLocaleTimeString("ar-EG", { hour12: false })}
          </span>
          <span className={cn("shrink-0", TYPE_STYLES[l.type])}>
            {TYPE_ICON[l.type]}
          </span>
          <span className="break-words text-foreground/90">{l.message}</span>
        </div>
      ))}
    </div>
  )
}
