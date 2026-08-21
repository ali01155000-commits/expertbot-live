"use client"

import * as React from "react"
import { useBotStore } from "@/lib/bot-store"
import { apiSaveBotConfig, apiExecuteTrade } from "@/lib/bot-api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Square, TrendingUp, TrendingDown } from "lucide-react"
import { STRATEGY_META, type StrategyId } from "@/lib/bot-types"
import { toast } from "sonner"

const STRATEGIES: StrategyId[] = ["ma_cross", "rsi", "trend", "martingale"]

export function BotControlPanel() {
  const account = useBotStore((s) => s.account)
  const config = useBotStore((s) => s.config)
  const updateConfig = useBotStore((s) => s.updateConfig)
  const botRunning = useBotStore((s) => s.botRunning)
  const setBotRunning = useBotStore((s) => s.setBotRunning)
  const selectedPair = useBotStore((s) => s.selectedPair)
  const pairs = useBotStore((s) => s.pairs)
  const addOpenTrade = useBotStore((s) => s.addOpenTrade)
  const setAccountBalance = useBotStore((s) => s.setAccountBalance)
  const addLog = useBotStore((s) => s.addLog)
  const setSelectedPair = useBotStore((s) => s.setSelectedPair)

  // keep config.pair in sync with selected chart pair when bot is stopped
  React.useEffect(() => {
    if (!botRunning) updateConfig({ pair: selectedPair })
  }, [selectedPair, botRunning, updateConfig])

  const persist = React.useCallback(
    async (patch: Partial<typeof config>) => {
      if (!account) return
      try {
        await apiSaveBotConfig({
          accountId: account.id,
          ...config,
          ...patch,
        })
      } catch {
        /* ignore persist errors */
      }
    },
    [account, config]
  )

  const onStrategy = (v: string) => {
    updateConfig({ strategy: v as StrategyId })
  }

  const toggleBot = async () => {
    if (!account) return
    if (botRunning) {
      setBotRunning(false)
      addLog({ type: "info", message: "تم إيقاف البوت يدوياً" })
      await persist({ active: false })
      return
    }
    if (config.amount <= 0) {
      toast.error("قيمة الرهان يجب أن تكون أكبر من صفر")
      return
    }
    if (config.amount > account.balance) {
      toast.error("الرهان أكبر من الرصيد المتاح")
      return
    }
    setBotRunning(true)
    addLog({
      type: "info",
      message: `▶ تشغيل البوت — ${STRATEGY_META[config.strategy].label} على ${selectedPair} | رهان ${config.amount}$`,
    })
    await persist({ active: true, pair: selectedPair })
  }

  const manualTrade = async (direction: "CALL" | "PUT") => {
    if (!account) return
    const st = pairs[selectedPair]
    if (!st) {
      toast.error("لا يوجد سعر حالي للزوج")
      return
    }
    if (config.amount > account.balance) {
      toast.error("الرهان أكبر من الرصيد المتاح")
      return
    }
    try {
      const { trade } = await apiExecuteTrade({
        accountId: account.id,
        pair: selectedPair,
        direction,
        amount: config.amount,
        expirySec: config.expirySec,
        source: "manual",
        strategy: null,
        entryPrice: st.price,
      })
      addOpenTrade(trade)
      setAccountBalance(account.balance - trade.amount)
      addLog({
        type: "trade",
        message: `صفقة يدوية ${direction === "CALL" ? "▲ شراء" : "▼ بيع"} ${selectedPair} @ ${st.price} | ${config.amount}$ / ${config.expirySec}ث`,
      })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const sMeta = STRATEGY_META[config.strategy]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">إستراتيجية البوت</Label>
          <Select
            value={config.strategy}
            onValueChange={onStrategy}
            disabled={botRunning}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STRATEGY_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {sMeta.desc}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">قيمة الرهان ($)</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={config.amount}
            disabled={botRunning}
            onChange={(e) =>
              updateConfig({ amount: Math.max(0, Number(e.target.value)) })
            }
            onBlur={(e) => persist({ amount: Number(e.target.value) })}
            className="font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">مدة الصفقة (ثانية)</Label>
          <Select
            value={String(config.expirySec)}
            onValueChange={(v) => {
              updateConfig({ expirySec: Number(v) })
              persist({ expirySec: Number(v) })
            }}
            disabled={botRunning}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[15, 30, 60, 120, 300].map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}ث
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <div>
            <Label className="text-xs font-medium">مارتينجال</Label>
            <p className="text-[10px] text-muted-foreground">
              مضاعفة الرهان بعد الخسارة ×{config.mgMultiplier}
            </p>
          </div>
          <Switch
            checked={config.martingale}
            onCheckedChange={(v) => {
              updateConfig({ martingale: v })
              persist({ martingale: v })
            }}
            disabled={botRunning}
          />
        </div>

        {config.martingale && (
          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">معامل المضاعفة</Label>
              <span className="font-mono text-xs">×{config.mgMultiplier}</span>
            </div>
            <Slider
              min={1.5}
              max={3}
              step={0.1}
              value={[config.mgMultiplier]}
              onValueChange={([v]) => updateConfig({ mgMultiplier: v })}
              onValueCommit={([v]) => persist({ mgMultiplier: v })}
              disabled={botRunning}
            />
          </div>
        )}

        <div className="col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              أقصى عدد صفقات (0 = لا حد)
            </Label>
            <span className="font-mono text-xs">{config.maxTrades}</span>
          </div>
          <Slider
            min={0}
            max={50}
            step={1}
            value={[config.maxTrades]}
            onValueChange={([v]) => updateConfig({ maxTrades: v })}
            onValueCommit={([v]) => persist({ maxTrades: v })}
            disabled={botRunning}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={toggleBot}
          variant={botRunning ? "destructive" : "default"}
          className="flex-1 gap-2"
          size="lg"
        >
          {botRunning ? (
            <>
              <Square className="h-4 w-4" /> إيقاف البوت
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> تشغيل البوت
            </>
          )}
        </Button>
      </div>

      <div className="rounded-md border border-white/10 bg-muted/30 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground">
            تداول يدوي سريع
          </span>
          {botRunning && (
            <Badge variant="secondary" className="text-[10px]">
              البوت يعمل
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => manualTrade("CALL")}
          >
            <TrendingUp className="h-4 w-4" /> شراء
          </Button>
          <Button
            variant="outline"
            className="gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
            onClick={() => manualTrade("PUT")}
          >
            <TrendingDown className="h-4 w-4" /> بيع
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>الزوج النشط:</span>
        <button
          className="font-mono font-semibold text-foreground"
          onClick={() => setSelectedPair(config.pair)}
        >
          {selectedPair}
        </button>
      </div>
    </div>
  )
}
