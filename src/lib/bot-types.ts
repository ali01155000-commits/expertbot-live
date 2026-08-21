// ExpertBot Pro — shared types

export interface Account {
  id: string
  email: string
  platformToken: string
  accountType: "demo" | "real"
  balance: number
  currency: string
  createdAt: string
  updatedAt: string
}

export type Direction = "CALL" | "PUT"
export type TradeStatus = "open" | "won" | "lost" | "tie"
export type TradeSource = "manual" | "bot"

export interface Trade {
  id: string
  accountId: string
  pair: string
  direction: Direction
  amount: number
  entryPrice: number
  exitPrice: number | null
  expirySec: number
  status: TradeStatus
  payout: number | null
  profit: number | null
  openedAt: string
  closedAt: string | null
  source: TradeSource
  strategy: string | null
}

export type StrategyId = "ma_cross" | "rsi" | "trend" | "martingale"

export interface BotConfig {
  id?: string
  accountId?: string
  strategy: StrategyId
  pair: string
  amount: number
  expirySec: number
  martingale: boolean
  mgMultiplier: number
  maxTrades: number
  active: boolean
}

export interface PairState {
  price: number
  prevPrice: number
  changePct: number
  decimals: number
}

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  decimals?: number
}

export interface LogEntry {
  id: string
  time: number
  type: "info" | "signal" | "trade" | "win" | "loss" | "warn" | "error"
  message: string
}

export const PAIR_META: Record<
  string,
  { label: string; decimals: number; icon: string }
> = {
  EURUSD: { label: "EUR/USD", decimals: 5, icon: "€" },
  GBPUSD: { label: "GBP/USD", decimals: 5, icon: "£" },
  USDJPY: { label: "USD/JPY", decimals: 3, icon: "¥" },
  BTCUSD: { label: "BTC/USD", decimals: 1, icon: "₿" },
  ETHUSD: { label: "ETH/USD", decimals: 2, icon: "Ξ" },
  AUDUSD: { label: "AUD/USD", decimals: 5, icon: "A$" },
}

export const STRATEGY_META: Record<
  StrategyId,
  { label: string; desc: string }
> = {
  ma_cross: {
    label: "تقاطع المتوسطات",
    desc: "شراء CALL عند تقاطع المتوسط السريع فوق البطيء، PUT عند العكس",
  },
  rsi: {
    label: "مؤشر RSI",
    desc: "CALL عند تشبع بيعي (<30)، PUT عند تشبع شرائي (>70)",
  },
  trend: {
    label: "متابعة الاتجاه",
    desc: "يتداول مع اتجاه آخر 10 شموع صاعدة/هابطة",
  },
  martingale: {
    label: "مارتينجال",
    desc: "يضاعف الرهان بعد كل خسارة لتعويضها (عالي المخاطر)",
  },
}
