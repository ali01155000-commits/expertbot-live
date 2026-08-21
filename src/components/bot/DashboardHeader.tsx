"use client"

import { useBotStore, formatPrice } from "@/lib/bot-store"
import { PAIR_META } from "@/lib/bot-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bot, LogOut, Wifi, Circle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const account = useBotStore((s) => s.account)
  const pairs = useBotStore((s) => s.pairs)
  const selectedPair = useBotStore((s) => s.selectedPair)
  const botRunning = useBotStore((s) => s.botRunning)
  const reset = useBotStore((s) => s.reset)

  const st = pairs[selectedPair]
  const meta = PAIR_META[selectedPair]
  const up = st ? st.price >= st.prevPrice : true

  const disconnect = () => {
    reset()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0e14]/90 px-3 backdrop-blur sm:px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-none">
            ExpertBot <span className="text-emerald-400">Pro</span>
          </span>
          <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">
            منصة التداول الآلي
          </span>
        </div>

        <div className="mr-2 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
          <Wifi className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] text-muted-foreground">متصل</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* selected pair price ticker */}
        {st && (
          <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-card/60 px-3 py-1 sm:flex">
            <span className="text-xs font-semibold">{meta?.label}</span>
            <span
              className={cn(
                "font-mono text-xs font-bold tabular-nums",
                up ? "text-emerald-400" : "text-red-400"
              )}
            >
              {formatPrice(st.price, st.decimals)}
            </span>
            <span
              className={cn(
                "text-[10px]",
                st.changePct >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {st.changePct >= 0 ? "▲" : "▼"} {Math.abs(st.changePct).toFixed(2)}%
            </span>
          </div>
        )}

        {/* balance */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground">الرصيد</span>
          <span className="font-mono text-sm font-bold text-emerald-400">
            {(account?.balance ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            $
          </span>
        </div>

        {botRunning && (
          <Badge className="gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">
            <Circle className="h-2 w-2 animate-pulse fill-emerald-400 text-emerald-400" />
            بوت نشط
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                  {account?.email?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{account?.email}</span>
                <span className="text-[10px] text-muted-foreground">
                  حساب {account?.accountType === "demo" ? "تجريبي" : "حقيقي"} ·{" "}
                  {account?.currency}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={disconnect}
              className="gap-2 text-red-400 focus:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              قطع الاتصال والخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
