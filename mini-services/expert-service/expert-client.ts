// expert-client.ts — WebSocket client to Expert Option servers.
// Faithful TypeScript port of the Python `ExpertOptionApi` library
// (https://github.com/ChipaDevTeam/ExpertOptionApi) — EoApi + WebSocketClient.
//
// KEY PROTOCOL NOTES (must match Python exactly):
//   * Send: ws.send(Buffer.from(encodeURIComponent(JSON.stringify(msg)), "utf-8"), { binary: true })
//   * Receive: plain UTF-8 JSON text → JSON.parse(data.toString("utf-8"))
//   * Origin header: https://app.expertoption.com
//   * SSL relaxed (rejectUnauthorized: false)
//   * Ping every 5s: {"action":"ping","v":23,"message":{}}
//   * Init: 3 multipleAction payloads + setContext (demo/real) after connect.
//
// All JSON parsing is defensive — Expert Option's data structures can vary slightly
// between versions, so every nested access is guarded with try/catch.

import WebSocket from "ws";

export const REGIONS: Record<string, string> = {
  EUROPE: "wss://fr24g1eu.expertoption.com/",
  INDIA: "wss://fr24g1in.expertoption.com/",
  HONG_KONG: "wss://fr24g1hk.expertoption.com/",
  SINGAPORE: "wss://fr24g1sg.expertoption.com/",
  UNITED_STATES: "wss://fr24g1us.expertoption.com/",
};

export interface ExpertCallbacks {
  onStatus: (connected: boolean, error?: string) => void;
  onProfile: (profile: any) => void;
  onAssets: (assets: any[]) => void;
  onCandle: (assetId: number, candle: { t: number; o: number; h: number; l: number; c: number }) => void;
  onTradeResult: (msg: any) => void;
  onLog: (type: string, message: string) => void;
  onRaw: (action: string, msg: any) => void;
}

export interface ExpertClientOptions {
  token: string;
  region: string; // full wss URL
  isDemo: boolean;
  callbacks: ExpertCallbacks;
}

export class ExpertClient {
  ws: WebSocket | null = null;
  token: string;
  region: string;
  isDemo: boolean = true;
  connected: boolean = false;
  pingInterval: any = null;

  // upstream callbacks
  onStatus: (connected: boolean, error?: string) => void;
  onProfile: (profile: any) => void;
  onAssets: (assets: any[]) => void;
  onCandle: (assetId: number, candle: { t: number; o: number; h: number; l: number; c: number }) => void;
  onTradeResult: (msg: any) => void;
  onLog: (type: string, message: string) => void;
  onRaw: (action: string, msg: any) => void;

  // cached state
  profileData: any = null;
  assetsData: any[] = [];
  candlesData: any = null;
  balance: number = 0;
  currency: string = "USD";

  // Track subscribed assetIds so we can re-subscribe on reconnect if needed
  subscribedAssets: Set<number> = new Set();

  constructor(token: string, region: string, isDemo: boolean, callbacks: ExpertCallbacks) {
    this.token = token;
    this.region = region;
    this.isDemo = isDemo;
    this.onStatus = callbacks.onStatus;
    this.onProfile = callbacks.onProfile;
    this.onAssets = callbacks.onAssets;
    this.onCandle = callbacks.onCandle;
    this.onTradeResult = callbacks.onTradeResult;
    this.onLog = callbacks.onLog;
    this.onRaw = callbacks.onRaw;
  }

  /** Open WS connection with 15s timeout. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          this.ws?.close();
        } catch {}
        this.onStatus(false, "انتهت مهلة الاتصال (15s)");
        reject(new Error("Connection timeout (15s)"));
      }, 15000);

      try {
        this.ws = new WebSocket(this.region, {
          origin: "https://app.expertoption.com",
          rejectUnauthorized: false,
        } as any);
      } catch (e: any) {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          this.onStatus(false, e?.message || "WS init error");
          reject(e);
        }
        return;
      }

      this.ws.on("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.onOpen();
        resolve();
      });

      this.ws.on("message", (data: WebSocket.RawData) => {
        try {
          this.onMessage(data as Buffer);
        } catch (e) {
          // swallow — defensive parsing
        }
      });

      this.ws.on("error", (err: Error) => {
        this.onError(err);
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      this.ws.on("close", () => {
        this.onClose();
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error("WS closed before open"));
        }
      });
    });
  }

  onOpen() {
    this.connected = true;
    this.onStatus(true);
    this.onLog("info", "تم الاتصال بخادم Expert Option");
    try {
      this.sendMultipleActionInit();
      this.setContext(this.isDemo);
      this.sendMultipleActionSecondary();
      this.sendMultipleActionTertiary();
    } catch (e: any) {
      this.onLog("error", "خطأ أثناء إرسال التهيئة: " + (e?.message || String(e)));
    }
    // start ping every 5s
    this.pingInterval = setInterval(() => {
      try {
        this.ping();
      } catch {}
    }, 5000);
  }

  /**
   * Send a message — PORT EXACTLY from Python:
   *   data = json.dumps(msg)
   *   ws.send(bytearray(urllib.parse.quote(data).encode('utf-8')), binary)
   */
  send(msg: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const json = JSON.stringify(msg);
    const encoded = encodeURIComponent(json);
    this.ws.send(Buffer.from(encoded, "utf-8"), { binary: true });
  }

  /**
   * The big init multipleAction payload from Python `connect()`.
   * 10 sub-actions: getCountries, getCurrency, profile, environment, assets,
   * openOptions, userGroup, setTimeZone, historySteps, tradeHistory.
   * ns="_common", v=18, token in each sub-action AND at the top.
   */
  sendMultipleActionInit() {
    const actions = [
      { action: "getCountries", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getCurrency", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "profile", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "environment", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "assets", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "openOptions", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "userGroup", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "setTimeZone", message: { tz: 180 }, token: this.token, ns: "_common", v: 18 },
      { action: "historySteps", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "tradeHistory", message: {}, token: this.token, ns: "_common", v: 18 },
    ];
    this.send({
      action: "multipleAction",
      message: { actions },
      token: this.token,
      ns: "_common",
      v: 18,
    });
  }

  /**
   * Second multipleAction: openOptions + tradeHistory (demo + real) + tournaments.
   * Mirrors Python `data2` payload.
   */
  sendMultipleActionSecondary() {
    const actions = [
      { action: "openOptions", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "tradeHistory", message: { is_demo: 1 }, token: this.token, ns: "_common", v: 18 },
      { action: "tradeHistory", message: { is_demo: 0 }, token: this.token, ns: "_common", v: 18 },
      { action: "getTournaments", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getTournamentInfo", message: {}, token: this.token, ns: "_common", v: 18 },
    ];
    this.send({
      action: "multipleAction",
      message: { actions },
      token: this.token,
      ns: "_common",
      v: 18,
    });
  }

  /**
   * Third multipleAction: the 9-action payload from Python `data` —
   * defaultSubscribeCandles, getSpinResult, etc.
   */
  sendMultipleActionTertiary() {
    const actions = [
      { action: "defaultSubscribeCandles", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getSpinResult", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "profile", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getLeaderboard", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getTradeOptions", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getCurrency", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "assets", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "getTournaments", message: {}, token: this.token, ns: "_common", v: 18 },
      { action: "openOptions", message: {}, token: this.token, ns: "_common", v: 18 },
    ];
    this.send({
      action: "multipleAction",
      message: { actions },
      token: this.token,
      ns: "_common",
      v: 18,
    });
  }

  /** Set demo or real trading context (Python SetDemo/SetReal). */
  setContext(isDemo: boolean) {
    this.send({
      action: "setContext",
      message: { is_demo: isDemo ? 1 : 0 },
      token: this.token,
      ns: 1,
    });
  }

  /** Subscribe to live candle stream for an asset. */
  subscribeCandles(assetId: number) {
    this.subscribedAssets.add(assetId);
    this.send({
      action: "subscribeCandles",
      message: {
        assets: [{ id: assetId, timeframes: [0, 5] }],
        modes: ["vanilla"],
      },
      token: this.token,
      ns: 18,
    });
  }

  /** Buy a binary option. exptime is in seconds. */
  buyOption(opts: {
    amount: number;
    type: "call" | "put";
    assetid: number;
    exptime: number;
    isdemo: boolean;
    strike_time: number;
  }) {
    const exp = this.roundTimeToTimestamp(opts.exptime);
    this.send({
      action: "buyOption",
      message: {
        type: opts.type,
        amount: opts.amount,
        assetid: opts.assetid,
        strike_time: opts.strike_time,
        expiration_time: exp,
        is_demo: opts.isdemo ? 1 : 0,
        rateIndex: 1,
      },
      token: this.token,
      ns: 44,
    });
  }

  /** Keep-alive ping (Python sends every 5s). */
  ping() {
    this.send({ action: "ping", v: 23, message: {} });
  }

  /**
   * Round current time to the nearest `roundTo`-second boundary.
   * Port of Python `_Utils.roundTimeToTimestamp`.
   */
  roundTimeToTimestamp(roundTo: number): number {
    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const seconds = nowSec % 86400;
    const rounding = Math.round((seconds + roundTo / 2) / roundTo) * roundTo;
    return nowSec - seconds + rounding;
  }

  /** Plain UTF-8 JSON on receive (NOT url-encoded on receive). */
  onMessage(data: Buffer) {
    let text: string;
    try {
      text = data.toString("utf-8");
    } catch {
      return;
    }
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    try {
      this.handleAction(msg);
    } catch (e: any) {
      this.onLog("error", "خطأ في معالجة الرسالة: " + (e?.message || String(e)));
    }
  }

  /** Route incoming message by `action`. Unwrap multipleAction recursively. */
  handleAction(msg: any) {
    if (!msg || typeof msg !== "object") return;
    const action = msg.action;
    if (!action || typeof action !== "string") return;

    if (action === "multipleAction") {
      const subs = msg?.message?.actions;
      if (Array.isArray(subs)) {
        for (const sub of subs) {
          try {
            this.handleAction(sub);
          } catch {}
        }
      }
      return;
    }

    // Let upstream see everything for debugging
    try {
      this.onRaw(action, msg);
    } catch {}

    switch (action) {
      case "profile": {
        this.profileData = msg;
        try {
          const m = msg?.message || {};
          const balance = typeof m.balance === "number" ? m.balance : this.balance;
          const currency = m.currency || this.currency;
          const isDemo = !!m.is_demo;
          const name = m.name || m.login || "";
          this.balance = balance;
          this.currency = currency;
          this.onProfile({ balance, currency, isDemo, name });
        } catch {}
        break;
      }
      case "assets": {
        try {
          const list = msg?.message?.assets || msg?.message || [];
          const mapped = (Array.isArray(list) ? list : []).map((a: any) => {
            if (!a || typeof a !== "object") return null;
            return { id: a.id, name: a.name, icon: a.icon || a.image || undefined, ...a };
          }).filter(Boolean);
          this.assetsData = mapped;
          this.onAssets(mapped);
        } catch {}
        break;
      }
      case "candles":
      case "subscribeCandles":
      case "defaultSubscribeCandles":
      case "assetHistoryCandles": {
        this.candlesData = msg;
        this.emitCandles(msg);
        break;
      }
      case "buyOption": {
        try {
          this.onTradeResult(msg);
        } catch {}
        break;
      }
      case "balance": {
        // some servers push a separate balance update
        try {
          const m = msg?.message || {};
          if (typeof m.balance === "number") {
            this.balance = m.balance;
            if (m.currency) this.currency = m.currency;
            this.onProfile({
              balance: this.balance,
              currency: this.currency,
              isDemo: this.isDemo,
              name: this.profileData?.message?.name || "",
            });
          }
        } catch {}
        break;
      }
      case "error": {
        try {
          this.onLog("error", "خطأ من الخادم: " + JSON.stringify(msg?.message || msg).slice(0, 300));
        } catch {}
        break;
      }
      default:
        // ignored silently; onRaw already forwarded it
        break;
    }
  }

  /**
   * Parse the candle data structure (from Python `extract_prices`):
   *   msg.message.candles = [{ periods: [[timestamp, [[o,h,l,c], ...]], ...], tf, assetid? }, ...]
   * For each period, take the LAST inner [o,h,l,c] as the current candle and emit it.
   * Defensive: structure may vary, so everything is wrapped in try/catch.
   */
  emitCandles(msg: any) {
    try {
      const m = msg?.message;
      if (!m) return;
      // Multiple possible shapes:
      //   1. m.candles = [ { assetid, periods: [ [ts, [[o,h,l,c],...]] ] } ]
      //   2. m.candles = [ { periods, assetid, tf } ]
      //   3. m.candles = [ { period: {ts, ohlc} } ]  (older format)
      const candlesArr = m.candles || m.data || m.list;
      if (!Array.isArray(candlesArr)) return;

      for (const c of candlesArr) {
        if (!c || typeof c !== "object") continue;
        const assetId: number = typeof c.assetid === "number"
          ? c.assetid
          : (typeof c.asset_id === "number" ? c.asset_id : (this.subscribedAssets.size === 1 ? Array.from(this.subscribedAssets)[0] : 240));
        const periods = c.periods || c.data || null;
        if (Array.isArray(periods)) {
          for (const p of periods) {
            if (!Array.isArray(p) || p.length < 2) continue;
            const t = p[0];
            const arr = p[1];
            if (Array.isArray(arr) && arr.length > 0) {
              const last = arr[arr.length - 1];
              if (Array.isArray(last) && last.length >= 4) {
                this.onCandle(assetId, {
                  t,
                  o: Number(last[0]),
                  h: Number(last[1]),
                  l: Number(last[2]),
                  c: Number(last[3]),
                });
              } else if (typeof last === "object" && last !== null) {
                // shape: { o, h, l, c } object
                const o = Number(last.o ?? last.open);
                const h = Number(last.h ?? last.high);
                const l = Number(last.l ?? last.low);
                const c2 = Number(last.c ?? last.close);
                if (!Number.isNaN(o) && !Number.isNaN(c2)) {
                  this.onCandle(assetId, { t, o, h, l, c: c2 });
                }
              }
            }
          }
        } else if (Array.isArray(c.ohlc)) {
          // flat [ts, o, h, l, c]
          const [t, o, h, l, cl] = c.ohlc;
          if (t != null && o != null && cl != null) {
            this.onCandle(assetId, { t: Number(t), o: Number(o), h: Number(h), l: Number(l), c: Number(cl) });
          }
        }
      }
    } catch {
      // swallow parse errors — be defensive
    }
  }

  onError(err: Error) {
    this.connected = false;
    this.onLog("error", "خطأ في الاتصال: " + (err?.message || String(err)));
    this.onStatus(false, err?.message || "WS error");
  }

  onClose() {
    const wasConnected = this.connected;
    this.connected = false;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (wasConnected) {
      this.onLog("warn", "انقطع الاتصال بخادم Expert Option");
    }
    this.onStatus(false, "connection closed");
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners?.();
        this.ws.close();
      } catch {}
    }
    this.ws = null;
    this.connected = false;
    this.onStatus(false);
  }
}
