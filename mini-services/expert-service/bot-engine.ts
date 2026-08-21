// bot-engine.ts — Automated trading engine for Expert Option.
// Strategies: alligator, rsi, ma_cross, trend.
// Tracks open trades, settles them at expiry using current price, applies
// martingale on losses, enforces maxTrades and balance limits.

import { ExpertClient } from "./expert-client";
import {
  Candle,
  alligatorFlip,
  closes,
  maCross,
  rsi,
  trendSignal,
} from "./indicators";

export type Strategy = "alligator" | "rsi" | "ma_cross" | "trend";
export type Direction = "call" | "put";
export type EmitFn = (event: string, data: any) => void;
export type LogFn = (type: string, message: string) => void;

export interface BotConfig {
  strategy: Strategy;
  assetId: number;
  amount: number;
  exptime: number; // seconds
  isDemo: boolean;
  martingale: boolean;
  mgMultiplier: number; // e.g. 2.0
  maxTrades: number; // 0 = unlimited
}

interface OpenTrade {
  id: string;
  direction: Direction;
  amount: number;
  assetId: number;
  entryPrice: number;
  expirySec: number;
  openedAtMs: number;
  source: "bot";
  strategy: Strategy;
}

interface ClosedTrade extends OpenTrade {
  exitPrice: number;
  profit: number;
  status: "win" | "loss" | "tie";
  won: boolean;
}

const PAYOUT = 0.85; // 85% profit on win

export class BotEngine {
  client: ExpertClient;
  emit: EmitFn;
  log: LogFn;

  running: boolean = false;
  config: BotConfig | null = null;
  tradesPlaced: number = 0;
  pnl: number = 0;
  openTrades: Map<string, OpenTrade> = new Map();
  currentAmount: number = 0;
  candles: Candle[] = [];
  lastCandleT: number = 0;
  timer: any = null;
  // track last signal time to avoid spamming trades on every tick
  lastSignalAtMs: number = 0;
  minSignalGapMs: number = 3000;

  constructor(client: ExpertClient, emit: EmitFn, log: LogFn) {
    this.client = client;
    this.emit = emit;
    this.log = log;
  }

  start(config: BotConfig) {
    if (this.running) this.stop();
    this.config = config;
    this.running = true;
    this.tradesPlaced = 0;
    this.pnl = 0;
    this.openTrades.clear();
    this.candles = [];
    this.lastCandleT = 0;
    this.currentAmount = config.amount;
    // subscribe to live candles for the configured asset
    try {
      this.client.subscribeCandles(config.assetId);
    } catch (e: any) {
      this.log("error", "تعذّر الاشتراك بشموع الأصل: " + (e?.message || String(e)));
    }
    // settle loop — every 1s check expired trades
    this.timer = setInterval(() => {
      try {
        this.settleLoop();
      } catch {}
    }, 1000);
    this.log("info", `▶ بدء البوت — استراتيجية ${config.strategy} | الأصل ${config.assetId} | رهان ${config.amount}$ | مدة ${config.exptime}ث`);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // emit final status
    this.emit("bot:status", {
      running: false,
      tradesPlaced: this.tradesPlaced,
      pnl: Number(this.pnl.toFixed(2)),
    });
  }

  /** Called by upstream (index.ts) on every new candle for any asset. */
  onCandle(candle: Candle) {
    if (!this.running || !this.config) return;
    if (candle.t === this.lastCandleT) {
      // update last candle's close in-place (live tick)
      if (this.candles.length > 0) {
        const last = this.candles[this.candles.length - 1];
        last.c = candle.c;
        last.h = Math.max(last.h, candle.h);
        last.l = Math.min(last.l, candle.l);
      }
      return;
    }
    if (candle.t < this.lastCandleT) return;
    this.lastCandleT = candle.t;
    this.candles.push({ ...candle });
    // keep a reasonable window
    if (this.candles.length > 200) this.candles.shift();
    // evaluate strategy on the new closed candle
    const dir = this.evaluate();
    if (dir) {
      const now = Date.now();
      if (now - this.lastSignalAtMs < this.minSignalGapMs) return;
      this.lastSignalAtMs = now;
      this.executeTrade(dir);
    }
  }

  /** Evaluate the configured strategy. Returns "call" | "put" | null. */
  evaluate(): Direction | null {
    if (!this.config) return null;
    const closesArr = closes(this.candles);
    try {
      switch (this.config.strategy) {
        case "alligator":
          return alligatorFlip(closesArr);
        case "rsi": {
          const r = rsi(closesArr, 14);
          if (r == null) return null;
          if (r < 30) return "call";
          if (r > 70) return "put";
          return null;
        }
        case "ma_cross":
          return maCross(closesArr, 3, 8);
        case "trend":
          return trendSignal(this.candles, 5);
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** Place a buyOption via the client and track it as an open trade. */
  executeTrade(direction: Direction) {
    if (!this.config || !this.client.connected) return;
    // respect maxTrades
    if (this.config.maxTrades > 0 && this.tradesPlaced >= this.config.maxTrades) {
      this.log("warn", `تم الوصول إلى الحد الأقصى للصفقات (${this.config.maxTrades}) — إيقاف البوت`);
      this.stop();
      return;
    }
    // respect balance
    const bal = this.client.balance || 0;
    if (bal > 0 && this.currentAmount > bal) {
      this.log("error", `الرصيد غير كافٍ — الرهان ${this.currentAmount}$ > الرصيد ${bal}$ — إيقاف البوت`);
      this.stop();
      return;
    }
    const cfg = this.config;
    const entryPrice = this.candles.length > 0 ? this.candles[this.candles.length - 1].c : 0;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const openedAtMs = Date.now();
    const trade: OpenTrade = {
      id,
      direction,
      amount: Number(this.currentAmount.toFixed(2)),
      assetId: cfg.assetId,
      entryPrice,
      expirySec: cfg.exptime,
      openedAtMs,
      source: "bot",
      strategy: cfg.strategy,
    };
    this.openTrades.set(id, trade);
    this.tradesPlaced += 1;
    try {
      this.client.buyOption({
        amount: trade.amount,
        type: direction,
        assetid: cfg.assetId,
        exptime: cfg.exptime,
        isdemo: cfg.isDemo,
        strike_time: Math.floor(openedAtMs / 1000),
      });
    } catch (e: any) {
      this.log("error", "فشل إرسال أمر الصفقة: " + (e?.message || String(e)));
      this.openTrades.delete(id);
      this.tradesPlaced -= 1;
      return;
    }
    this.emit("expert:trade-open", {
      id: trade.id,
      direction: trade.direction,
      amount: trade.amount,
      assetId: trade.assetId,
      entryPrice: trade.entryPrice,
      expirySec: trade.expirySec,
      openedAt: new Date(openedAtMs).toISOString(),
      source: "bot",
      strategy: trade.strategy,
    });
    this.emit("bot:status", {
      running: this.running,
      tradesPlaced: this.tradesPlaced,
      pnl: Number(this.pnl.toFixed(2)),
    });
    this.log("signal", `📥 إشارة ${cfg.strategy.toUpperCase()} → ${direction === "call" ? "صعود CALL" : "هبوط PUT"} | رهان ${trade.amount}$`);
  }

  /** Periodic check: settle any trade whose expiry has elapsed. */
  settleLoop() {
    if (!this.running || this.openTrades.size === 0) return;
    const now = Date.now();
    for (const [id, trade] of Array.from(this.openTrades.entries())) {
      if (now - trade.openedAtMs < trade.expirySec * 1000) continue;
      // expired — settle using the latest known close
      const lastClose = this.candles.length > 0 ? this.candles[this.candles.length - 1].c : trade.entryPrice;
      this.settle(trade, lastClose);
      this.openTrades.delete(id);
    }
  }

  /** Compute outcome, emit close event, update pnl + martingale. */
  settle(trade: OpenTrade, exitPrice: number) {
    let status: "win" | "loss" | "tie";
    if (exitPrice > trade.entryPrice) {
      status = trade.direction === "call" ? "win" : "loss";
    } else if (exitPrice < trade.entryPrice) {
      status = trade.direction === "put" ? "win" : "loss";
    } else {
      status = "tie";
    }
    let profit: number;
    if (status === "win") {
      profit = Number((trade.amount * PAYOUT).toFixed(2));
    } else if (status === "loss") {
      profit = -trade.amount;
    } else {
      profit = 0;
    }
    this.pnl += profit;
    const closed: ClosedTrade = {
      ...trade,
      exitPrice,
      profit,
      status,
      won: status === "win",
    };
    this.emit("expert:trade-close", {
      id: closed.id,
      direction: closed.direction,
      amount: closed.amount,
      assetId: closed.assetId,
      entryPrice: closed.entryPrice,
      exitPrice: closed.exitPrice,
      profit: closed.profit,
      status: closed.status,
      source: closed.source,
      strategy: closed.strategy,
      won: closed.won,
    });
    this.emit("bot:status", {
      running: this.running,
      tradesPlaced: this.tradesPlaced,
      pnl: Number(this.pnl.toFixed(2)),
    });
    // martingale logic
    if (this.config?.martingale) {
      if (status === "loss") {
        this.currentAmount = Number((this.currentAmount * (this.config.mgMultiplier || 2)).toFixed(2));
        this.log("loss", `❌ خسارة ${trade.amount}$ — مارتينجال: الرهان التالي ${this.currentAmount}$`);
      } else if (status === "win") {
        this.currentAmount = this.config.amount; // reset on win
        this.log("win", `✅ ربح ${profit}$ — إعادة الرهان إلى ${this.currentAmount}$`);
      } else {
        this.log("info", `🟰 تعادل — الرهان يبقى ${this.currentAmount}$`);
      }
    } else {
      if (status === "win") this.log("win", `✅ ربح ${profit}$`);
      else if (status === "loss") this.log("loss", `❌ خسارة ${trade.amount}$`);
      else this.log("info", `🟰 تعادل`);
    }
  }
}
