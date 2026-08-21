"use client"

import * as React from "react"
import { useBotStore, calcSMA, calcRSI } from "@/lib/bot-store"
import {
  apiExecuteTrade,
  apiSettleTrade,
  apiOpenTrades,
  apiHistory,
} from "@/lib/bot-api"
import type { Candle, Direction } from "@/lib/bot-types"
import { toast } from "sonner"

const EMPTY_CANDLES: Candle[] = []

function evaluate(
  strategy: string,
  candles: Candle[]
): Direction | null {
  if (candles.length < 5) return null
  const closes = candles.map((c) => c.c)

  if (strategy === "ma_cross") {
    if (closes.length < 8) return null
    const fast = calcSMA(closes, 3)
    const slow = calcSMA(closes, 8)
    const prevFast = calcSMA(closes.slice(0, -1), 3)
    const prevSlow = calcSMA(closes.slice(0, -1), 8)
    if (fast == null || slow == null || prevFast == null || prevSlow == null)
      return null
    if (prevFast <= prevSlow && fast > slow) return "CALL"
    if (prevFast >= prevSlow && fast < slow) return "PUT"
    return null
  }

  if (strategy === "rsi") {
    const rsi = calcRSI(closes, 7)
    if (rsi == null) return null
    if (rsi < 30) return "CALL"
    if (rsi > 70) return "PUT"
    return null
  }

  if (strategy === "trend") {
    const last5 = candles.slice(-5)
    const ups = last5.filter((c) => c.c > c.o).length
    const downs = 5 - ups
    if (ups >= 4) return "CALL"
    if (downs >= 4) return "PUT"
    return null
  }

  if (strategy === "martingale") {
    if (closes.length < 8) return null
    const fast = calcSMA(closes, 3)
    const slow = calcSMA(closes, 8)
    if (fast == null || slow == null) return null
    if (fast > slow) return "CALL"
    if (fast < slow) return "PUT"
    return null
  }

  return null
}

export function BotEngine() {
  const connected = useBotStore((s) => s.connected)
  const account = useBotStore((s) => s.account)
  const botRunning = useBotStore((s) => s.botRunning)
  const config = useBotStore((s) => s.config)
  const candlesAll = useBotStore((s) => s.candles)
  const pairs = useBotStore((s) => s.pairs)
  const openTrades = useBotStore((s) => s.openTrades)
  const addOpenTrade = useBotStore((s) => s.addOpenTrade)
  const removeOpenTrade = useBotStore((s) => s.removeOpenTrade)
  const addHistory = useBotStore((s) => s.addHistory)
  const setHistory = useBotStore((s) => s.setHistory)
  const setOpenTrades = useBotStore((s) => s.setOpenTrades)
  const setAccountBalance = useBotStore((s) => s.setAccountBalance)
  const addLog = useBotStore((s) => s.addLog)
  const incBotTrades = useBotStore((s) => s.incBotTrades)
  const setBotTradesCount = useBotStore((s) => s.setBotTradesCount)

  // mutable bot session state
  const session = React.useRef({
    lastSignalTime: 0,
    lastSignalDir: null as Direction | null,
    currentAmount: config.amount,
    tradesPlaced: 0,
    lastCandleT: 0,
  })

  // reset session when bot starts
  React.useEffect(() => {
    if (botRunning) {
      session.current.currentAmount = config.amount
      session.current.tradesPlaced = 0
      session.current.lastSignalTime = 0
      session.current.lastSignalDir = null
      setBotTradesCount(0)
    }
  }, [botRunning])

  // load open trades + history on connect
  React.useEffect(() => {
    if (!connected || !account) return
    ;(async () => {
      try {
        const [open, hist] = await Promise.all([
          apiOpenTrades(account.id),
          apiHistory(account.id, 50),
        ])
        setOpenTrades(open.trades)
        setHistory(hist.trades)
      } catch {
        /* ignore */
      }
    })()
  }, [connected, account, setOpenTrades, setHistory])

  // settle expired open trades on an interval
  React.useEffect(() => {
    if (!connected || !account) return
    const iv = setInterval(async () => {
      const now = Date.now()
      const expired = openTrades.filter((t) => {
        const opened = new Date(t.openedAt).getTime()
        return now - opened >= t.expirySec * 1000
      })
      for (const t of expired) {
        const cur = pairs[t.pair]?.price
        if (cur == null) continue
        try {
          const { trade, won } = await apiSettleTrade(t.id, cur)
          removeOpenTrade(t.id)
          addHistory(trade)
          setAccountBalance(
            (useBotStore.getState().account?.balance ?? 0) +
              (trade.payout ?? 0)
          )
          if (t.source === "bot" && config.martingale) {
            if (won) {
              session.current.currentAmount = config.amount
            } else {
              session.current.currentAmount = Math.min(
                session.current.currentAmount * config.mgMultiplier,
                (useBotStore.getState().account?.balance ?? 0)
              )
            }
          }
          const tag = t.source === "bot" ? "🤖" : "✋"
          if (won) {
            addLog({
              type: "win",
              message: `${tag} ربحت ${trade.profit?.toFixed(2)}$ — ${t.pair} ${t.direction} (دخول ${t.entryPrice} ← خروج ${cur})`,
            })
          } else if (trade.status === "tie") {
            addLog({
              type: "info",
              message: `${tag} تعادل — ${t.pair} (أُعيد الرهان)`,
            })
          } else {
            addLog({
              type: "loss",
              message: `${tag} خسرت ${Math.abs(trade.profit ?? 0).toFixed(2)}$ — ${t.pair} ${t.direction} (دخول ${t.entryPrice} ← خروج ${cur})`,
            })
          }
        } catch (e) {
          addLog({
            type: "error",
            message: `فشل تسوية الصفقة ${t.id.slice(0, 6)}: ${(e as Error).message}`,
          })
        }
      }
    }, 600)
    return () => clearInterval(iv)
  }, [
    connected,
    account,
    openTrades,
    pairs,
    config.martingale,
    config.mgMultiplier,
    config.amount,
    removeOpenTrade,
    addHistory,
    setAccountBalance,
    addLog,
  ])

  // bot signal evaluation: watch the bot pair's candles
  const botPair = config.pair
  const candles = candlesAll[botPair] ?? EMPTY_CANDLES

  React.useEffect(() => {
    if (!connected || !account || !botRunning) return
    if (candles.length < 5) return

    const last = candles[candles.length - 1]
    // only evaluate when a NEW candle arrived
    if (last.t === session.current.lastCandleT) return
    session.current.lastCandleT = last.t

    // respect maxTrades
    if (config.maxTrades > 0 && session.current.tradesPlaced >= config.maxTrades) {
      addLog({
        type: "info",
        message: `تم الوصول لأقصى عدد صفقات (${config.maxTrades}) — أوقف البوت يدوياً لإعادة التشغيل`,
      })
      return
    }

    const dir = evaluate(config.strategy, candles)
    if (!dir) return

    // avoid spamming same direction on every candle; require cooldown
    const now = Date.now()
    const cooldown = Math.max(6000, config.expirySec * 600)
    if (
      session.current.lastSignalDir === dir &&
      now - session.current.lastSignalTime < cooldown
    ) {
      return
    }

    const st = pairs[botPair]
    if (!st) return
    const amt = session.current.currentAmount
    const bal = useBotStore.getState().account?.balance ?? 0
    if (amt > bal) {
      addLog({
        type: "warn",
        message: `الرصيد غير كافٍ لرهان ${amt.toFixed(2)}$ — تم إيقاف البوت`,
      })
      useBotStore.getState().setBotRunning(false)
      return
    }

    session.current.lastSignalTime = now
    session.current.lastSignalDir = dir

    ;(async () => {
      try {
        const { trade } = await apiExecuteTrade({
          accountId: account.id,
          pair: botPair,
          direction: dir,
          amount: amt,
          expirySec: config.expirySec,
          source: "bot",
          strategy: config.strategy,
          entryPrice: st.price,
        })
        addOpenTrade(trade)
        setAccountBalance(bal - trade.amount)
        incBotTrades()
        session.current.tradesPlaced++
        addLog({
          type: "signal",
          message: `✦ إشارة ${config.strategy} → ${dir === "CALL" ? "▲ شراء" : "▼ بيع"} ${botPair} @ ${st.price} | رهان ${amt.toFixed(2)}$`,
        })
        addLog({
          type: "trade",
          message: `🤖 نُفذت صفقة ${trade.id.slice(0, 6)} · مدة ${config.expirySec}ث`,
        })
      } catch (e) {
        addLog({
          type: "error",
          message: `فشل تنفيذ صفقة البوت: ${(e as Error).message}`,
        })
      }
    })()
  }, [
    connected,
    account,
    botRunning,
    candles,
    botPair,
    config.strategy,
    config.expirySec,
    config.maxTrades,
    pairs,
    addOpenTrade,
    setAccountBalance,
    incBotTrades,
    addLog,
  ])

  return null
}
