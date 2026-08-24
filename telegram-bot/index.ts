// ExpertBot Telegram Bot
// يعمل على VPS، يتلقى الأوامر من تيليجرام، ويتداول تلقائياً على Expert Option
//
// الأوامر:
// /start - بدء البوت
// /token <TOKEN> - إدخال توكن Expert Option
// /strategy <name> - اختيار الإستراتيجية (trend/rsi/ma_cross/alligator)
// /amount <number> - قيمة الرهان
// /expiry <seconds> - مدة الصفقة
// /run - تشغيل البوت
// /stop - إيقاف البوت
// /status - حالة البوت
// /balance - الرصيد

import TelegramBot from "node-telegram-bot-api";
import WebSocket from "ws";

// ===== الإعدادات =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "ضع_توكن_البوت_هنا";
const ADMIN_KEY = process.env.ADMIN_KEY || "expertbot-admin-2024";

// ===== حالة كل مستخدم =====
interface UserSession {
  chatId: number;
  eoToken: string | null;
  eoWs: WebSocket | null;
  eoConnected: boolean;
  balance: number;
  strategy: string;
  amount: number;
  expiry: number;
  botRunning: boolean;
  botTimer: any;
  tradesCount: number;
  pnl: number;
  recentCloses: number[];
  lastSignalTime: number;
  pingTimer: any;
}

const sessions = new Map<number, UserSession>();

// ===== بوت تيليجرام =====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("✅ ExpertBot Telegram بدأ العمل...");

// ===== الأوامر =====

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      chatId,
      eoToken: null,
      eoWs: null,
      eoConnected: false,
      balance: 0,
      strategy: "trend",
      amount: 10,
      expiry: 30,
      botRunning: false,
      botTimer: null,
      tradesCount: 0,
      pnl: 0,
      recentCloses: [],
      lastSignalTime: 0,
      pingTimer: null,
    });
  }
  bot.sendMessage(
    chatId,
    "🤖 *ExpertBot Live — بوت تداول Expert Option*\n\n" +
      "أهلاً بك! لإبدأ التداول:\n\n" +
      "1️⃣ احصل على توكن Expert Option:\n" +
      "   - افتح app.expertoption.com\n" +
      "   - سجل دخولك\n" +
      "   - اضغط F12 → Console\n" +
      "   - الصق: copy(JSON.stringify(localStorage))\n" +
      "   - اضغط Enter، انسخ النتيجة\n\n" +
      "2️⃣ أرسل التوكن هنا:\n" +
      "   /token <النص المنسوخ>\n\n" +
      "3️⃣ شغّل البوت:\n" +
      "   /run\n\n" +
      "📝 الأوامر:\n" +
      "/token - إدخال التوكن\n" +
      "/strategy - اختيار الإستراتيجية\n" +
      "/amount - قيمة الرهان\n" +
      "/expiry - مدة الصفقة\n" +
      "/run - تشغيل البوت\n" +
      "/stop - إيقاف البوت\n" +
      "/status - الحالة\n" +
      "/balance - الرصيد",
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/token\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;

  let input = match![1].trim();
  
  // محاولة استخراج التوكن من JSON
  let token = null;
  try {
    const parsed = JSON.parse(input);
    if (parsed.token) token = parsed.token;
    else if (parsed.auth) {
      const auth = typeof parsed.auth === "string" ? JSON.parse(parsed.auth) : parsed.auth;
      token = auth.token;
    }
  } catch {
    // ربما التوكن مباشرة
    if (/^[a-f0-9]{20,}$/i.test(input)) {
      token = input;
    }
  }

  if (!token) {
    bot.sendMessage(
      chatId,
      "❌ تعذّر استخراج التوكن من النص.\n\n" +
        "تأكد من نسخ كل الناتج من Console.\n" +
        "أو أرسل التوكن مباشرة إذا كنت تعرفه."
    );
    return;
  }

  session.eoToken = token;
  bot.sendMessage(
    chatId,
    `✅ تم استلام التوكن!\n\nالتوكن: \`${token.slice(0, 8)}...${token.slice(-4)}\`\n\n` +
      "الآن استخدم /run لتشغيل البوت",
    { parse_mode: "Markdown" }
  );

  // اتصال بـ Expert Option
  connectExpertOption(session);
});

bot.onText(/\/strategy\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  const strat = match![1].trim().toLowerCase();
  if (["trend", "rsi", "ma_cross", "alligator"].includes(strat)) {
    session.strategy = strat;
    bot.sendMessage(chatId, `✅ الإستراتيجية: ${strat}`);
  } else {
    bot.sendMessage(
      chatId,
      "الإستراتيجيات المتاحة:\n- trend (متابعة الاتجاه)\n- rsi (مؤشر RSI)\n- ma_cross (تقاطع المتوسطات)\n- alligator"
    );
  }
});

bot.onText(/\/amount\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  const amount = Number(match![1].trim());
  if (amount > 0) {
    session.amount = amount;
    bot.sendMessage(chatId, `✅ قيمة الرهان: ${amount}$`);
  } else {
    bot.sendMessage(chatId, "❌ أدخل رقم صحيح");
  }
});

bot.onText(/\/expiry\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  const expiry = Number(match![1].trim());
  if ([15, 30, 60, 120, 300].includes(expiry)) {
    session.expiry = expiry;
    bot.sendMessage(chatId, `✅ مدة الصفقة: ${expiry} ثانية`);
  } else {
    bot.sendMessage(chatId, "المدد المتاحة: 15، 30، 60، 120، 300 ثانية");
  }
});

bot.onText(/\/run/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;

  if (!session.eoToken) {
    bot.sendMessage(chatId, "❌ أدخل التوكن أولاً: /token <توكن>");
    return;
  }
  if (!session.eoConnected) {
    bot.sendMessage(chatId, "❌ غير متصل بـ Expert Option. انتظر قليلاً...");
    connectExpertOption(session);
    return;
  }

  session.botRunning = true;
  session.tradesCount = 0;
  session.pnl = 0;
  bot.sendMessage(
    chatId,
    `🚀 *البوت يعمل!*\n\n` +
      `الإستراتيجية: ${session.strategy}\n` +
      `الرهان: ${session.amount}$\n` +
      `المدة: ${session.expiry}ث\n\n` +
      `للإيقاف: /stop`,
    { parse_mode: "Markdown" }
  );

  // حلقة البوت
  session.botTimer = setInterval(async () => {
    if (!session.botRunning) return;
    await botLoop(session);
  }, 5000);
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  session.botRunning = false;
  if (session.botTimer) {
    clearInterval(session.botTimer);
    session.botTimer = null;
  }
  bot.sendMessage(
    chatId,
    `⏹ *تم إيقاف البوت*\n\nصفقات: ${session.tradesCount}\nالربح: ${session.pnl.toFixed(2)}$`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  bot.sendMessage(
    chatId,
    `📊 *حالة البوت*\n\n` +
      `متصل: ${session.eoConnected ? "✅" : "❌"}\n` +
      `يعمل: ${session.botRunning ? "✅" : "❌"}\n` +
      `الإستراتيجية: ${session.strategy}\n` +
      `الرهان: ${session.amount}$\n` +
      `المدة: ${session.expiry}ث\n` +
      `صفقات: ${session.tradesCount}\n` +
      `الربح: ${session.pnl.toFixed(2)}$`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  bot.sendMessage(chatId, `💰 الرصيد: ${session.balance.toFixed(2)}$`);
});

// ===== الاتصال بـ Expert Option =====

function connectExpertOption(session: UserSession) {
  if (!session.eoToken) return;
  
  const WS_URL = "wss://fr24g1eu.expertoption.com/";
  
  bot.sendMessage(session.chatId, "🔌 جارٍ الاتصال بـ Expert Option...");

  const ws = new WebSocket(WS_URL, {
    origin: "https://app.expertoption.com",
    rejectUnauthorized: false,
  });

  session.eoWs = ws;

  ws.on("open", () => {
    console.log(`[User ${session.chatId}] متصل بـ Expert Option`);
    // إرسال رسالة التهيئة
    const initMsg = {
      action: "multipleAction",
      message: {
        token: session.eoToken,
        v: 18,
        action: "multipleAction",
        message: {
          token: session.eoToken,
          actions: [
            { action: "profile", message: null, ns: 2, v: 18, token: session.eoToken },
            { action: "assets", message: { mode: ["vanilla"], subscribeMode: ["vanilla"] }, ns: 3, v: 18, token: session.eoToken },
            { action: "defaultSubscribeCandles", message: { modes: ["vanilla"], timeframes: [0, 5] }, ns: 7, v: 18, token: session.eoToken },
          ],
        },
      },
      token: session.eoToken,
      ns: 2,
    };

    sendToExpert(ws, initMsg);
    sendToExpert(ws, { action: "setContext", message: { is_demo: 1 }, token: session.eoToken, ns: 1 });

    // ping كل 5 ثوان
    session.pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendToExpert(ws, { action: "ping", v: 23, message: {} });
      }
    }, 5000);
  });

  ws.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString("utf-8"));
      handleExpertMessage(session, msg);
    } catch {}
  });

  ws.on("error", (err) => {
    console.error(`[User ${session.chatId}] خطأ:`, err.message);
    session.eoConnected = false;
    bot.sendMessage(session.chatId, `❌ خطأ في الاتصال: ${err.message}`);
  });

  ws.on("close", () => {
    session.eoConnected = false;
    if (session.pingTimer) clearInterval(session.pingTimer);
    if (session.botRunning) {
      bot.sendMessage(session.chatId, "⚠️ انقطع الاتصال بـ Expert Option. أعد الإرسال: /run");
      session.botRunning = false;
      if (session.botTimer) clearInterval(session.botTimer);
    }
  });
}

function sendToExpert(ws: WebSocket, msg: any) {
  const json = JSON.stringify(msg);
  const encoded = encodeURIComponent(json);
  ws.send(Buffer.from(encoded, "utf-8"), { binary: true });
}

function handleExpertMessage(session: UserSession, msg: any) {
  const action = msg?.action;
  if (!action) return;

  if (action === "multipleAction" && msg?.message?.actions) {
    for (const sub of msg.message.actions) {
      handleExpertMessage(session, sub);
    }
    return;
  }

  if (action === "profile") {
    session.balance = msg?.message?.balance ?? session.balance;
    if (!session.eoConnected) {
      session.eoConnected = true;
      bot.sendMessage(
        session.chatId,
        `✅ *متصل بـ Expert Option!*\n💰 الرصيد: ${session.balance}$\n\nاستخدم /run لتشغيل البوت`,
        { parse_mode: "Markdown" }
      );
    }
  }

  if (action === "candles" || action === "subscribeCandles") {
    try {
      const candles = msg?.message?.candles || [];
      for (const c of candles) {
        const periods = c.periods || [];
        for (const p of periods) {
          const arr = p[1];
          if (Array.isArray(arr) && arr.length > 0) {
            const last = arr[arr.length - 1];
            if (last && last.length >= 4) {
              session.recentCloses.push(last[3]);
              if (session.recentCloses.length > 50) session.recentCloses.shift();
            }
          }
        }
      }
    } catch {}
  }

  if (action === "buyOption") {
    bot.sendMessage(
      session.chatId,
      `📊 صفقة منفّذة: ${msg?.message?.type === "call" ? "▲ شراء" : "▼ بيع"}`
    );
  }

  if (action === "error") {
    bot.sendMessage(session.chatId, `⚠️ خطأ: ${JSON.stringify(msg?.message || msg).slice(0, 200)}`);
  }
}

// ===== حلقة البوت =====

async function botLoop(session: UserSession) {
  if (!session.botRunning || !session.eoConnected) return;

  const candles = session.recentCloses;
  if (candles.length < 8) return;

  const dir = evaluate(session.strategy, candles);
  if (!dir) return;

  const now = Date.now();
  if (now - session.lastSignalTime < 15000) return;
  session.lastSignalTime = now;

  // تنفيذ الصفقة
  const strikeTime = Math.floor(now / 1000);
  const expTime = roundTime(session.expiry);

  const buyMsg = {
    action: "buyOption",
    message: {
      type: dir,
      amount: session.amount,
      assetid: 240,
      strike_time: strikeTime,
      expiration_time: expTime,
      is_demo: 1,
      rateIndex: 1,
    },
    token: session.eoToken,
    ns: 44,
  };

  sendToExpert(session.eoWs!, buyMsg);
  session.tradesCount++;

  bot.sendMessage(
    session.chatId,
    `🎯 *إشارة ${session.strategy}!*\n\n` +
      `${dir === "call" ? "▲ شراء CALL" : "▼ بيع PUT"}\n` +
      `الرهان: ${session.amount}$\n` +
      `المدة: ${session.expiry}ث\n` +
      `الصفقة #${session.tradesCount}`,
    { parse_mode: "Markdown" }
  );
}

// ===== الإستراتيجيات =====

function evaluate(strategy: string, candles: number[]): "call" | "put" | null {
  if (candles.length < 8) return null;

  if (strategy === "ma_cross") {
    const fast = sma(candles, 3);
    const slow = sma(candles, 8);
    const prevFast = sma(candles.slice(0, -1), 3);
    const prevSlow = sma(candles.slice(0, -1), 8);
    if (fast == null || slow == null || prevFast == null || prevSlow == null) return null;
    if (prevFast <= prevSlow && fast > slow) return "call";
    if (prevFast >= prevSlow && fast < slow) return "put";
  } else if (strategy === "rsi") {
    const r = rsi(candles, 7);
    if (r == null) return null;
    if (r < 30) return "call";
    if (r > 70) return "put";
  } else if (strategy === "trend") {
    const last5 = candles.slice(-5);
    const ups = last5.filter((v, i) => i > 0 && v > last5[i - 1]).length;
    if (ups >= 4) return "call";
    if (ups <= 1) return "put";
  } else if (strategy === "alligator") {
    const jaw = sma(candles, 13);
    const teeth = sma(candles, 8);
    const lips = sma(candles, 5);
    if (jaw == null || teeth == null || lips == null) return null;
    if (lips > teeth && teeth > jaw) return "call";
    if (lips < teeth && teeth < jaw) return "put";
  }
  return null;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

function roundTime(expiry: number): number {
  const now = new Date();
  const seconds = Math.floor(now.getTime() / 1000) % 86400;
  const rounding = Math.round((seconds + expiry / 2) / expiry) * expiry;
  return Math.floor(now.getTime() / 1000) - seconds + rounding;
}

// ===== معالجة الرسائل العادية =====

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // تجاهل الأوامر
  if (text.startsWith("/")) return;

  // إذا لم يكن لديه جلسة، ابدأ
  if (!sessions.has(chatId)) {
    bot.sendMessage(chatId, "أرسل /start للبدء");
    return;
  }

  const session = sessions.get(chatId)!;

  // إذا كان النص يحتوي على توكن محتمل
  if (text.length > 20 && !session.eoToken) {
    bot.sendMessage(
      chatId,
      "هل هذا توكن Expert Option؟\nأرسله هكذا:\n/token " + text.slice(0, 50) + "..."
    );
  }
});
