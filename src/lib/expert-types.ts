// Expert Option trading bot — shared types and metadata.

import type { Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Account / Profile
// ---------------------------------------------------------------------------

export interface Profile {
  balance: number;
  currency: string;
  isDemo: boolean;
  name?: string;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface Asset {
  id: number;
  name: string;
  icon?: string;
}

// ---------------------------------------------------------------------------
// Candles
// ---------------------------------------------------------------------------

export interface Candle {
  t: number; // timestamp (seconds)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export type TradeDirection = "call" | "put";
export type TradeSource = "bot" | "manual";

export interface TradeOpen {
  id: string;
  direction: TradeDirection;
  amount: number;
  assetId: number;
  entryPrice: number;
  expirySec: number;
  openedAt: number; // ms epoch
  source: TradeSource;
  strategy?: string;
}

export interface TradeClose {
  id: string;
  direction: TradeDirection;
  amount: number;
  assetId: number;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  status: "won" | "lost" | "draw";
  source: TradeSource;
  strategy?: string;
  won: boolean;
  closedAt?: number; // ms epoch — derived client side if not provided
}

// ---------------------------------------------------------------------------
// Bot config + stats
// ---------------------------------------------------------------------------

export type StrategyKey = "alligator" | "rsi" | "ma_cross" | "trend";

export interface BotConfig {
  strategy: StrategyKey;
  assetId: number;
  amount: number;
  exptime: number; // expiry in seconds
  isDemo: boolean;
  martingale: boolean;
  mgMultiplier: number; // 1.5 - 3
  maxTrades: number; // 0 = unlimited
}

export interface BotStats {
  running: boolean;
  tradesPlaced: number;
  pnl: number;
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export type LogType =
  | "info"
  | "signal"
  | "trade"
  | "win"
  | "loss"
  | "warn"
  | "error";

export interface LogEntry {
  type: LogType;
  message: string;
  time: number; // ms epoch
}

// ---------------------------------------------------------------------------
// Regions (5 Expert Option data centers)
// ---------------------------------------------------------------------------

export interface RegionMeta {
  key: string;
  url: string;
  labelAr: string;
  flag: string;
}

export const REGIONS: Record<string, RegionMeta> = {
  EUROPE: {
    key: "EUROPE",
    url: "wss://fr24g1eu.expertoption.com/",
    labelAr: "أوروبا",
    flag: "🇪🇺",
  },
  INDIA: {
    key: "INDIA",
    url: "wss://fr24g1in.expertoption.com/",
    labelAr: "الهند",
    flag: "🇮🇳",
  },
  HONG_KONG: {
    key: "HONG_KONG",
    url: "wss://fr24g1hk.expertoption.com/",
    labelAr: "هونغ كونغ",
    flag: "🇭🇰",
  },
  SINGAPORE: {
    key: "SINGAPORE",
    url: "wss://fr24g1sg.expertoption.com/",
    labelAr: "سنغافورة",
    flag: "🇸🇬",
  },
  UNITED_STATES: {
    key: "UNITED_STATES",
    url: "wss://fr24g1us.expertoption.com/",
    labelAr: "أمريكا",
    flag: "🇺🇸",
  },
};

export const REGION_LIST: RegionMeta[] = Object.values(REGIONS);

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export interface StrategyMeta {
  key: StrategyKey;
  labelAr: string;
  descriptionAr: string;
}

export const STRATEGY_META: Record<StrategyKey, StrategyMeta> = {
  alligator: {
    key: "alligator",
    labelAr: "التمساح (Alligator)",
    descriptionAr:
      "يعتمد على تقاطع三条 خطوط Alligator (الفك/الأسنان/الشفتين) لرصد بداية الاتجاه.",
  },
  rsi: {
    key: "rsi",
    labelAr: "مؤشر القوة النسبية (RSI)",
    descriptionAr:
      "يشتري عند تشبع بيعي (<30) ويبيع عند تشبع شرائي (>70). مناسب للسوق العرضي.",
  },
  ma_cross: {
    key: "ma_cross",
    labelAr: "تقاطع المتوسطات (MA Cross)",
    descriptionAr:
      "تقاطع المتوسط المتحرك السريع فوق البطيء = شراء، والعكس = بيع. كلاسيكي وبسيط.",
  },
  trend: {
    key: "trend",
    labelAr: "متابعة الاتجاه (Trend)",
    descriptionAr:
      "يتبع الاتجاه العام باستخدام قمم وقيعان تصاعدية/هابطة مع تأكيد الزخم.",
  },
};

export const STRATEGY_LIST: StrategyMeta[] = Object.values(STRATEGY_META);

// ---------------------------------------------------------------------------
// Socket.io event payloads (frontend side)
// ---------------------------------------------------------------------------

export interface ExpertStatusPayload {
  connected: boolean;
  error?: string;
  region?: string;
}

export type ExpertProfilePayload = Profile;

export type ExpertAssetsPayload = {
  assets: Asset[];
};

export interface ExpertCandlePayload {
  assetId: number;
  candle: Candle;
}

export type ExpertTradeOpenPayload = TradeOpen;

export type ExpertTradeClosePayload = TradeClose;

export interface BotStatusPayload {
  running: boolean;
  tradesPlaced: number;
  pnl: number;
}

export interface LogPayload {
  type: LogType;
  message: string;
  time: number;
}

// ---------------------------------------------------------------------------
// Convenience: socket type alias
// ---------------------------------------------------------------------------

export type ExpertSocket = Socket;
