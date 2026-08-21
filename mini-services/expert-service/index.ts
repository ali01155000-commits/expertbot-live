// index.ts — Expert Option connector mini-service.
// Bun + TypeScript + socket.io server on port 3003 (path "/").
// Bridges the frontend (socket.io) with the Expert Option WebSocket API
// (ported from the Python ExpertOptionApi library).

import { createServer } from "http";
import { Server } from "socket.io";
import { ExpertClient, REGIONS } from "./expert-client";
import { BotEngine } from "./bot-engine";

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Per-socket state. Each frontend connection has its own client + bot.
interface SocketState {
  client: ExpertClient | null;
  bot: BotEngine | null;
}
const sockets = new Map<string, SocketState>();

function getState(id: string): SocketState {
  let s = sockets.get(id);
  if (!s) {
    s = { client: null, bot: null };
    sockets.set(id, s);
  }
  return s;
}

io.on("connection", (socket) => {
  console.log("frontend connected:", socket.id);
  const state = getState(socket.id);

  socket.on("expert:connect", (payload: { token: string; region?: string; isDemo?: boolean }) => {
    const { token, region, isDemo = true } = payload || {};
    if (!token) {
      socket.emit("expert:status", { connected: false, error: "الرمز (token) مطلوب" });
      return;
    }
    const regionUrl = region && REGIONS[region] ? REGIONS[region] : (region || REGIONS.EUROPE);
    if (state.client) {
      try { state.client.disconnect(); } catch {}
      state.client = null;
    }
    const client = new ExpertClient(token, regionUrl, isDemo, {
      onStatus: (connected, error) => socket.emit("expert:status", { connected, error, region: regionUrl }),
      onProfile: (p) => socket.emit("expert:profile", p),
      onAssets: (a) => socket.emit("expert:assets", { assets: a }),
      onCandle: (assetId, candle) => {
        socket.emit("expert:candle", { assetId, candle });
        // also emit a derived tick (latest close) for simpler frontend charts
        socket.emit("expert:tick", { assetId, price: candle.c });
        if (state.bot) state.bot.onCandle(candle);
      },
      onTradeResult: (msg) => socket.emit("log", {
        type: "trade",
        message: "نتيجة صفقة: " + JSON.stringify(msg).slice(0, 200),
        time: Date.now(),
      }),
      onLog: (type, message) => socket.emit("log", { type, message, time: Date.now() }),
      onRaw: (action, msg) => {
        // optionally forward unknown actions for debugging — keep quiet by default
        // socket.emit("expert:raw", { action, msg });
      },
    });
    state.client = client;
    client.connect().catch((e: any) => {
      socket.emit("expert:status", { connected: false, error: e?.message || "WS connect failed" });
    });
  });

  socket.on("expert:disconnect", () => {
    if (state.client) {
      try { state.client.disconnect(); } catch {}
      state.client = null;
      socket.emit("expert:status", { connected: false });
      socket.emit("log", { type: "info", message: "تم قطع الاتصال", time: Date.now() });
    }
  });

  socket.on("expert:set-asset", (payload: { assetId: number }) => {
    const { assetId } = payload || {};
    if (!assetId) return;
    if (state.client && state.client.connected) {
      state.client.subscribeCandles(assetId);
      socket.emit("log", { type: "info", message: `تم اختيار الأصل ${assetId}`, time: Date.now() });
    } else {
      socket.emit("log", { type: "warn", message: "غير متصل — تعذّر اشتراك الشموع", time: Date.now() });
    }
  });

  socket.on("expert:manual-trade", (payload: { direction: "call" | "put"; amount: number; exptime: number }) => {
    const { direction, amount, exptime } = payload || {};
    if (!state.client || !state.client.connected) {
      socket.emit("log", { type: "error", message: "غير متصل بالمنصة", time: Date.now() });
      return;
    }
    const assetId = state.bot?.config?.assetId || 240;
    const entryPrice = 0; // unknown until first tick; the bot/tracker will refine
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    state.client.buyOption({
      amount,
      type: direction,
      assetid: assetId,
      exptime,
      isdemo: state.client.isDemo,
      strike_time: Math.floor(Date.now() / 1000),
    });
    socket.emit("expert:trade-open", {
      id,
      direction,
      amount,
      assetId,
      entryPrice,
      expirySec: exptime,
      openedAt: new Date().toISOString(),
      source: "manual",
      strategy: null,
    });
    socket.emit("log", {
      type: "trade",
      message: `📥 صفقة يدوية ${direction === "call" ? "صعود" : "هبوط"} | رهان ${amount}$ | مدة ${exptime}ث`,
      time: Date.now(),
    });
  });

  socket.on("bot:start", (config: any) => {
    if (!state.client || !state.client.connected) {
      socket.emit("log", { type: "error", message: "اتصل بالمنصة أولاً", time: Date.now() });
      return;
    }
    if (state.bot) {
      try { state.bot.stop(); } catch {}
      state.bot = null;
    }
    const cfg = {
      strategy: config?.strategy || "alligator",
      assetId: Number(config?.assetId || 240),
      amount: Number(config?.amount || 10),
      exptime: Number(config?.exptime || 60),
      isDemo: config?.isDemo !== undefined ? !!config.isDemo : state.client.isDemo,
      martingale: !!config?.martingale,
      mgMultiplier: Number(config?.mgMultiplier || 2),
      maxTrades: Number(config?.maxTrades || 0),
    };
    const bot = new BotEngine(
      state.client,
      (evt, data) => socket.emit(evt, data),
      (type, msg) => socket.emit("log", { type, message: msg, time: Date.now() })
    );
    state.bot = bot;
    bot.start(cfg);
    socket.emit("bot:status", { running: true, tradesPlaced: 0, pnl: 0 });
    socket.emit("log", {
      type: "info",
      message: `▶ تشغيل البوت — ${cfg.strategy} | رهان ${cfg.amount}$ | مدة ${cfg.exptime}ث`,
      time: Date.now(),
    });
  });

  socket.on("bot:stop", () => {
    if (state.bot) {
      try { state.bot.stop(); } catch {}
      state.bot = null;
      socket.emit("bot:status", { running: false, tradesPlaced: 0, pnl: 0 });
      socket.emit("log", { type: "info", message: "تم إيقاف البوت", time: Date.now() });
    }
  });

  socket.on("bot:status", () => {
    if (state.bot) {
      socket.emit("bot:status", {
        running: state.bot.running,
        tradesPlaced: state.bot.tradesPlaced,
        pnl: Number(state.bot.pnl.toFixed(2)),
      });
    } else {
      socket.emit("bot:status", { running: false, tradesPlaced: 0, pnl: 0 });
    }
  });

  socket.on("disconnect", () => {
    console.log("frontend disconnected:", socket.id);
    if (state.client) {
      try { state.client.disconnect(); } catch {}
    }
    if (state.bot) {
      try { state.bot.stop(); } catch {}
    }
    sockets.delete(socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3003;
httpServer.listen(PORT, () => {
  console.log(`Expert service listening on :${PORT}`);
});

// graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down…");
  for (const s of sockets.values()) {
    try { s.client?.disconnect(); } catch {}
    try { s.bot?.stop(); } catch {}
  }
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down…");
  for (const s of sockets.values()) {
    try { s.client?.disconnect(); } catch {}
    try { s.bot?.stop(); } catch {}
  }
  httpServer.close(() => process.exit(0));
});
