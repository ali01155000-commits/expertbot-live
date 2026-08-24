// Expert Option trading bot — Zustand store + socket.io singleton + helpers.

"use client";

import { create } from "zustand";
import { io, type Socket } from "socket.io-client";

import {
  type Asset,
  type BotConfig,
  type BotStats,
  type Candle,
  type ExpertCandlePayload,
  type ExpertAssetsPayload,
  type ExpertProfilePayload,
  type ExpertStatusPayload,
  type ExpertTradeClosePayload,
  type ExpertTradeOpenPayload,
  type ExpertSocket as ExpertSocketType,
  type LogEntry,
  type LogPayload,
  type LogType,
  type Profile,
  type TradeClose,
  type TradeOpen,
  type BotStatusPayload,
} from "./expert-types";

// ---------------------------------------------------------------------------
// Module-level constants (avoid Zustand getSnapshot infinite loops)
// ---------------------------------------------------------------------------

export const EMPTY_CANDLES: Candle[] = [];
export const EMPTY_ASSETS: Asset[] = [];
export const EMPTY_OPEN_TRADES: TradeOpen[] = [];
export const EMPTY_HISTORY: TradeClose[] = [];
export const EMPTY_LOGS: LogEntry[] = [];

const MAX_CANDLES = 80;
const MAX_LOGS = 120;
const MAX_HISTORY = 200;

export const DEFAULT_BOT_CONFIG: BotConfig = {
  strategy: "alligator",
  assetId: 240,
  amount: 10,
  exptime: 60,
  isDemo: true,
  martingale: false,
  mgMultiplier: 2,
  maxTrades: 0,
};

export const DEFAULT_BOT_STATS: BotStats = {
  running: false,
  tradesPlaced: 0,
  pnl: 0,
};

// ---------------------------------------------------------------------------
// Socket singleton (kept OUT of reactive state to avoid re-render storms)
// ---------------------------------------------------------------------------

let socketInstance: Socket | null = null;
let listenersAttached = false;

function attachExpertListeners(socket: Socket, store: ExpertStoreApi) {
  if (listenersAttached) return;
  listenersAttached = true;

  const log = (type: LogType, message: string) =>
    store.getState().addLog({ type, message, time: Date.now() });

  // --- Expert Option status / connection lifecycle
  socket.on("expert:status", (data: ExpertStatusPayload) => {
    const s = store.getState();
    // إذا كان logging=true، لا تغير connecting (البوت لا يزال يسجل الدخول)
    if (data.logging) {
      s.setConnecting(true);
      s.setConnectionError(null);
      log("info", "جارٍ تسجيل الدخول بـ Expert Option...");
      return;
    }
    s.setConnected(!!data.connected);
    s.setConnecting(false);
    if (data.region) s.setRegion(data.region);
    if (data.error) {
      s.setConnectionError(data.error);
      log("error", `خطأ الاتصال: ${data.error}`);
    } else {
      s.setConnectionError(null);
    }
    if (data.connected) {
      log("info", `تم الاتصال بـ Expert Option${data.region ? ` (${data.region})` : ""}`);
    } else if (!data.error) {
      log("warn", "تم قطع الاتصال بـ Expert Option");
    }
  });

  socket.on("expert:profile", (data: ExpertProfilePayload) => {
    store.getState().setProfile(data);
    log("info", `تم تحميل الملف: ${data.balance} ${data.currency} (${data.isDemo ? "تجريبي" : "حقيقي"})`);
  });

  socket.on("expert:assets", (data: ExpertAssetsPayload) => {
    store.getState().setAssets(data.assets ?? []);
    const count = data.assets?.length ?? 0;
    if (count > 0) log("info", `تم استلام ${count} أصل قابل للتداول`);
  });

  socket.on("expert:candle", (data: ExpertCandlePayload) => {
    store.getState().pushCandle(data.assetId, data.candle);
  });

  // --- Trades
  socket.on("expert:trade-open", (data: ExpertTradeOpenPayload) => {
    store.getState().addOpenTrade(data);
    const dir = data.direction === "call" ? "شراء ▲" : "بيع ▼";
    log("trade", `${dir} | ${data.amount}$ | ${data.source === "bot" ? "🤖 بوت" : "✋ يدوي"}${data.strategy ? ` (${data.strategy})` : ""}`);
  });

  socket.on("expert:trade-close", (data: ExpertTradeClosePayload) => {
    store.getState().closeTrade(data.id, data);
    const won = data.won;
    const sign = data.profit >= 0 ? "+" : "";
    if (won) {
      log("win", `صفقة رابحة | ربح ${sign}${data.profit.toFixed(2)}$`);
    } else {
      log("loss", `صفقة خاسرة | خسارة ${data.profit.toFixed(2)}$`);
    }
  });

  // --- Bot
  socket.on("bot:status", (data: BotStatusPayload) => {
    store.getState().setBotStats({
      running: !!data.running,
      tradesPlaced: data.tradesPlaced ?? 0,
      pnl: data.pnl ?? 0,
    });
    store.getState().setBotRunning(!!data.running);
    if (data.running) {
      log("info", `البوت يعمل | ${data.tradesPlaced} صفقة | PnL ${data.pnl.toFixed(2)}$`);
    } else {
      log("info", `تم إيقاف البوت | ${data.tradesPlaced} صفقة | PnL ${data.pnl.toFixed(2)}$`);
    }
  });

  // --- Generic log
  socket.on("log", (data: LogPayload) => {
    store.getState().addLog({
      type: data.type ?? "info",
      message: data.message ?? "",
      time: data.time ?? Date.now(),
    });
  });

  // --- Transport lifecycle
  socket.on("connect", () => {
    log("info", "تم الاتصال بالخادم المحلي (socket.io)");
  });
  socket.on("disconnect", (reason: unknown) => {
    log("warn", `انقطع الاتصال بالخادم المحلي: ${String(reason)}`);
  });
  socket.on("connect_error", (err: unknown) => {
    log("error", `خطأ اتصال socket.io: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/**
 * Lazily create the singleton socket.io client + attach all listeners.
 * Safe to call from multiple components — the socket is created only once.
 *
 * Connection URL resolution:
 *  - Production: set NEXT_PUBLIC_EXPERT_SERVICE_URL to your deployed service
 *    (e.g. "https://yourdomain.com" — Nginx proxies /socket.io to the service)
 *  - Sandbox/dev: fall back to the Caddy gateway hack "?XTransformPort=3003"
 */
export function ensureExpertSocket(): Socket {
  if (!socketInstance) {
    // Production: connect via /socket.io/ (Nginx proxies to expert-service:3003)
    // Sandbox: Caddy gateway uses ?XTransformPort=3003
    const isProduction = typeof window !== "undefined" && window.location.protocol === "https:";
    if (isProduction) {
      socketInstance = io({
        path: "/",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 15000,
      });
    } else {
      socketInstance = io("/?XTransformPort=3003", {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 15000,
      });
    }
    attachExpertListeners(socketInstance, useExpertStore as unknown as ExpertStoreApi);
    useExpertStore.getState().setSocket(socketInstance);
  }
  return socketInstance;
}

/** React hook: returns the singleton socket (creates it on first call). */
export function useExpertSocket(): Socket {
  // Always ensure on render — idempotent.
  return ensureExpertSocket();
}

/** Direct accessor (for non-hook contexts). */
export function getExpertSocket(): Socket | null {
  return socketInstance;
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface ExpertState {
  // Activation code state
  activated: boolean;
  activationCode: string | null;
  paid: boolean;
  guideSeen: boolean;

  // socket.io client (kept here for API completeness; do not subscribe to it
  // in components — use useExpertSocket()/getExpertSocket() instead).
  socket: ExpertSocketType | null;

  // Expert Option connection state
  connected: boolean;
  connecting: boolean;
  connectionError: string | null;
  region: string | null;

  // Profile / account
  profile: Profile | null;
  assets: Asset[];
  selectedAssetId: number;
  candles: Candle[];
  currentPrice: number | null;

  // Bot
  botConfig: BotConfig;
  botRunning: boolean;
  botStats: BotStats;

  // Trades
  openTrades: TradeOpen[];
  history: TradeClose[];
  logs: LogEntry[];
}

interface ExpertActions {
  setActivated: (v: boolean) => void;
  setActivationCode: (c: string | null) => void;
  setPaid: (v: boolean) => void;
  setGuideSeen: (v: boolean) => void;
  setSocket: (s: ExpertSocketType | null) => void;
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setConnectionError: (e: string | null) => void;
  setRegion: (r: string | null) => void;
  setProfile: (p: Profile | null) => void;
  setAssets: (a: Asset[]) => void;
  setSelectedAsset: (id: number) => void;
  pushCandle: (assetId: number, candle: Candle) => void;
  addOpenTrade: (t: TradeOpen) => void;
  closeTrade: (id: string, data: TradeClose) => void;
  addLog: (entry: LogEntry) => void;
  setBotRunning: (v: boolean) => void;
  setBotStats: (s: BotStats) => void;
  updateConfig: (patch: Partial<BotConfig>) => void;
  reset: () => void;
}

type ExpertStoreApi = {
  getState: () => ExpertState & ExpertActions;
};

type ExpertStore = ExpertState & ExpertActions;

const initialState: ExpertState = {
  activated: false,
  activationCode: null,
  paid: typeof window !== "undefined" && localStorage.getItem("expertbot.paid") === "1",
  guideSeen:
    typeof window !== "undefined" && localStorage.getItem("expertbot.guideSeen") === "1",
  socket: null,
  connected: false,
  connecting: false,
  connectionError: null,
  region: null,
  profile: null,
  assets: EMPTY_ASSETS,
  selectedAssetId: 240,
  candles: EMPTY_CANDLES,
  currentPrice: null,
  botConfig: DEFAULT_BOT_CONFIG,
  botRunning: false,
  botStats: DEFAULT_BOT_STATS,
  openTrades: EMPTY_OPEN_TRADES,
  history: EMPTY_HISTORY,
  logs: EMPTY_LOGS,
};

export const useExpertStore = create<ExpertStore>((set) => ({
  // استرجع حالة التفعيل من localStorage (client-side)
  activated:
    typeof window !== "undefined" && !!localStorage.getItem("expertbot.activation"),
  activationCode:
    typeof window !== "undefined"
      ? localStorage.getItem("expertbot.activation") || null
      : null,
  socket: null,

  setActivated: (v) => {
    set({ activated: v });
    if (!v) {
      try {
        localStorage.removeItem("expertbot.activation");
      } catch {}
    }
  },
  setActivationCode: (c) => {
    set({ activationCode: c });
    if (c) {
      try {
        localStorage.setItem("expertbot.activation", c);
      } catch {}
    }
  },
  setPaid: (v) => {
    set({ paid: v });
    try {
      localStorage.setItem("expertbot.paid", v ? "1" : "0");
    } catch {}
  },
  setGuideSeen: (v) => {
    set({ guideSeen: v });
    try {
      localStorage.setItem("expertbot.guideSeen", v ? "1" : "0");
    } catch {}
  },
  setSocket: (s) => set({ socket: s }),

  setConnected: (v) => set({ connected: v }),
  setConnecting: (v) => set({ connecting: v }),
  setConnectionError: (e) => set({ connectionError: e }),
  setRegion: (r) => set({ region: r }),

  setProfile: (p) => set({ profile: p }),
  setAssets: (a) => set({ assets: a && a.length ? a : EMPTY_ASSETS }),

  setSelectedAsset: (id) =>
    set({
      selectedAssetId: id,
      candles: EMPTY_CANDLES,
      currentPrice: null,
      // also reflect into botConfig.assetId so the bot starts on the visible asset
      botConfig: { ...useExpertStore.getState().botConfig, assetId: id },
    }),

  pushCandle: (assetId, candle) =>
    set((state) => {
      if (assetId !== state.selectedAssetId) return state;
      const prev = state.candles;
      // If last candle has the same timestamp, replace it (live update).
      let next: Candle[];
      if (prev.length > 0 && prev[prev.length - 1].t === candle.t) {
        next = prev.slice(0, -1);
        next.push(candle);
      } else {
        next = prev.length >= MAX_CANDLES ? prev.slice(prev.length - MAX_CANDLES + 1) : prev.slice();
        next.push(candle);
      }
      return { candles: next, currentPrice: candle.c };
    }),

  addOpenTrade: (t) =>
    set((state) => ({ openTrades: [...state.openTrades, t] })),

  closeTrade: (id, data) =>
    set((state) => {
      const open = state.openTrades.filter((t) => t.id !== id);
      const closed: TradeClose = { ...data, closedAt: Date.now() };
      const history = [closed, ...state.history].slice(0, MAX_HISTORY);
      return { openTrades: open, history };
    }),

  addLog: (entry) =>
    set((state) => {
      const logs = [...state.logs, entry];
      if (logs.length > MAX_LOGS) {
        return { logs: logs.slice(logs.length - MAX_LOGS) };
      }
      return { logs };
    }),

  setBotRunning: (v) => set({ botRunning: v }),

  setBotStats: (s) => set({ botStats: s, botRunning: s.running }),

  updateConfig: (patch) =>
    set((state) => ({ botConfig: { ...state.botConfig, ...patch } })),

  reset: () =>
    set({
      ...initialState,
      // احتفظ بحالة التفعيل (لا ينسى الكود عند قطع الاتصال)
      activated: useExpertStore.getState().activated,
      activationCode: useExpertStore.getState().activationCode,
      socket: useExpertStore.getState().socket,
    }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a price with a fixed number of decimals + thousands separator.
 */
export function formatPrice(price: number | null | undefined, decimals = 2): string {
  if (price == null || Number.isNaN(price)) return "—";
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Compute win-rate percentage from closed-trade history.
 */
export function computeWinRate(history: TradeClose[]): { wins: number; losses: number; rate: number } {
  if (!history.length) return { wins: 0, losses: 0, rate: 0 };
  let wins = 0;
  let losses = 0;
  for (const t of history) {
    if (t.won) wins++;
    else losses++;
  }
  const rate = (wins / (wins + losses)) * 100;
  return { wins, losses, rate };
}

/**
 * Sum of profit across closed trades.
 */
export function computePnl(history: TradeClose[]): number {
  return history.reduce((acc, t) => acc + (t.profit || 0), 0);
}
