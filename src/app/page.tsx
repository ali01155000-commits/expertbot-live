"use client"

import * as React from "react"
import { useBotStore } from "@/lib/bot-store"
import { LoginScreen } from "@/components/bot/LoginScreen"
import { DashboardHeader } from "@/components/bot/DashboardHeader"
import { StatsCards } from "@/components/bot/StatsCards"
import { PairList } from "@/components/bot/PairList"
import { CandlestickChart } from "@/components/bot/CandlestickChart"
import { BotControlPanel } from "@/components/bot/BotControlPanel"
import { OpenPositions } from "@/components/bot/OpenPositions"
import { ActivityLog } from "@/components/bot/ActivityLog"
import { TradeHistory } from "@/components/bot/TradeHistory"
import { MarketSocket } from "@/components/bot/MarketSocket"
import { BotEngine } from "@/components/bot/BotEngine"
import { PAIR_META } from "@/lib/bot-types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CandlestickChart as ChartIcon,
  Bot as BotIcon,
  ListOrdered,
  ScrollText,
  History,
  ShieldAlert,
} from "lucide-react"

export default function Home() {
  const connected = useBotStore((s) => s.connected)
  const selectedPair = useBotStore((s) => s.selectedPair)

  if (!connected) {
    return (
      <>
        <LoginScreen />
        <BotEngine />
      </>
    )
  }

  const meta = PAIR_META[selectedPair]

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0e14] text-foreground">
      <MarketSocket />
      <BotEngine />

      <DashboardHeader />

      <main className="flex flex-1 flex-col gap-4 p-3 sm:p-4">
        {/* risk banner */}
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[11px] text-amber-200/80">
            وضع المحاكاة — جميع الأسعار والصفقات وهمية لأغراض تعليمية. لا تُخاطر
            بأموال حقيقية في التداول الآلي.
          </p>
        </div>

        <StatsCards />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* left: pair list */}
          <aside className="lg:col-span-2">
            <Card className="border-white/10 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListOrdered className="h-4 w-4 text-emerald-400" />
                  الأزواج
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <PairList />
              </CardContent>
            </Card>
          </aside>

          {/* center: chart + bot panel */}
          <section className="flex flex-col gap-4 lg:col-span-7">
            <Card className="border-white/10 bg-card/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ChartIcon className="h-4 w-4 text-emerald-400" />
                  {meta?.label} — رسم شموع حي
                </CardTitle>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    5ث/شمعة
                  </span>
                  <span>· مباشر</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-hidden rounded-md bg-black/20 p-2">
                  <CandlestickChart />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BotIcon className="h-4 w-4 text-emerald-400" />
                  لوحة تحكم البوت
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <BotControlPanel />
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="h-4 w-4 text-emerald-400" />
                  سجل الصفقات المنتهية
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TradeHistory />
              </CardContent>
            </Card>
          </section>

          {/* right: positions + logs */}
          <aside className="flex flex-col gap-4 lg:col-span-3">
            <Card className="border-white/10 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListOrdered className="h-4 w-4 text-emerald-400" />
                  الصفقات المفتوحة
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <OpenPositions />
              </CardContent>
            </Card>

            <Card className="flex-1 border-white/10 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ScrollText className="h-4 w-4 text-emerald-400" />
                  سجل النشاط
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ActivityLog />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="mt-auto border-t border-white/10 bg-[#070a0f] px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center text-[11px] text-muted-foreground sm:flex-row sm:text-right">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-400">ExpertBot Pro</span>
            <span>· محاكي بوت تداول آلي · للتعليم فقط</span>
          </div>
          <div className="flex items-center gap-3">
            <span>إستراتيجيات: MA · RSI · Trend · Martingale</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
