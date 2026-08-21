"use client"

import { create } from "zustand"
import type {
  Account,
  Trade,
  BotConfig,
  PairState,
  Candle,
  LogEntry,
  StrategyId,
} from "./bot-types"

interface BotState {
  // connection
  account: Account | null
  connecting: boolean
  connected: boolean

  // market data
  pairs: Record<string, PairState>
  candles: Record<string, Candle[]> // pair -> recent candles
  selectedPair: string

  // bot
  config: BotConfig
  botRunning: boolean
  botTradesCount: number

  // trades
  openTrades: Trade[]
  history: Trade[]

  // logs
  logs: LogEntry[]

  // actions
  setAccount: (a: Account | null) => void
  setConnecting: (v: boolean) => void
  setConnected: (v: boolean) => void
  setPairs: (p: Record<string, PairState>) => void
  updatePair: (pair: string, p: PairState) => void
  pushCandle: (pair: string, c: Candle) => void
  setSelectedPair: (p: string) => void
  updateConfig: (patch: Partial<BotConfig>) => void
  setBotRunning: (v: boolean) => void
  setBotTradesCount: (n: number) => void
  incBotTrades: () => void
  setOpenTrades: (t: Trade[]) => void
  addOpenTrade: (t: Trade) => void
  removeOpenTrade: (id: string) => void
  setHistory: (t: Trade[]) => void
  addHistory: (t: Trade) => void
  setAccountBalance: (b: number) => void
  addLog: (l: Omit<LogEntry, "id" | "time">) => void
  clearLogs: () => void
  reset: () => void
}

const MAX_CANDLES = 80
const MAX_LOGS = 120

const defaultConfig: BotConfig = {
  strategy: "ma_cross",
  pair: "EURUSD",
  amount: 50,
  expirySec: 30,
  martingale: false,
  mgMultiplier: 2,
  maxTrades: 0,
  active: false,
}

export const useBotStore = create<BotState>((set, get) => ({
  account: null,
  connecting: false,
  connected: false,

  pairs: {},
  candles: {},
  selectedPair: "EURUSD",

  config: { ...defaultConfig },
  botRunning: false,
  botTradesCount: 0,

  openTrades: [],
  history: [],

  logs: [],

  setAccount: (a) => set({ account: a }),
  setConnecting: (v) => set({ connecting: v }),
  setConnected: (v) => set({ connected: v }),
  setPairs: (p) => set({ pairs: p }),
  updatePair: (pair, p) =>
    set((s) => ({ pairs: { ...s.pairs, [pair]: p } })),
  pushCandle: (pair, c) =>
    set((s) => {
      const arr = s.candles[pair] ? [...s.candles[pair]] : []
      const last = arr[arr.length - 1]
      if (last && last.t === c.t) {
        arr[arr.length - 1] = c
      } else {
        arr.push(c)
        if (arr.length > MAX_CANDLES) arr.shift()
      }
      return { candles: { ...s.candles, [pair]: arr } }
    }),
  setSelectedPair: (p) => set({ selectedPair: p }),
  updateConfig: (patch) =>
    set((s) => ({ config: { ...s.config, ...patch } })),
  setBotRunning: (v) => set({ botRunning: v }),
  setBotTradesCount: (n) => set({ botTradesCount: n }),
  incBotTrades: () =>
    set((s) => ({ botTradesCount: s.botTradesCount + 1 })),
  setOpenTrades: (t) => set({ openTrades: t }),
  addOpenTrade: (t) =>
    set((s) => ({ openTrades: [t, ...s.openTrades] })),
  removeOpenTrade: (id) =>
    set((s) => ({ openTrades: s.openTrades.filter((t) => t.id !== id) })),
  setHistory: (t) => set({ history: t }),
  addHistory: (t) =>
    set((s) => ({ history: [t, ...s.history].slice(0, 100) })),
  setAccountBalance: (b) =>
    set((s) => ({ account: s.account ? { ...s.account, balance: b } : null })),
  addLog: (l) =>
    set((s) => ({
      logs: [
        ...s.logs,
        { ...l, id: Math.random().toString(36).slice(2), time: Date.now() },
      ].slice(-MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
  reset: () =>
    set({
      account: null,
      connecting: false,
      connected: false,
      pairs: {},
      candles: {},
      openTrades: [],
      history: [],
      logs: [],
      botRunning: false,
      botTradesCount: 0,
      config: { ...defaultConfig },
      selectedPair: "EURUSD",
    }),
}))

// strategy helpers
export function formatPrice(price: number, decimals: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) sum += values[i]
  return sum / period
}

export function calcRSI(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null
  let gains = 0
  let losses = 0
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}
