// ExpertBot Telegram Bot — مع WebApp (متصفح داخل تيليجرام)
// يفتح Expert Option داخل تيليجرام، يلتقط التوكن تلقائياً، ويتداول
//
// الأوامر:
// /start - بدء البوت (يظهر زر "فتح Expert Option")
// /run - تشغيل البوت
// /stop - إيقاف البوت
// /status - الحالة
// /balance - الرصيد

import TelegramBot from "node-telegram-bot-api";
import WebSocket from "ws";
import http from "http";
import { URL } from "url";

// ===== الإعدادات =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8943921942:AAFabWQ7_cQt0ZfctM2sFAA6FQm7RqT-u4k";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://alfa-option.com";
const PORT = 3010;

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
  waitingForToken: boolean;
}

const sessions = new Map<number, UserSession>();

// ===== خادم HTTP لاستقبال التوكن من WebApp =====
const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://localhost:${PORT}`);

  // صفحة WebApp — تفتح Expert Option وتلتقط التوكن
  if (url.pathname === "/" || url.pathname === "/webapp") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(WEBAPP_HTML);
    return;
  }

  // استقبال التوكن من WebApp
  if (url.pathname === "/capture-token" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const chatId = data.chatId;
        const token = data.token;

        if (chatId && token) {
          const session = sessions.get(Number(chatId));
          if (session) {
            session.eoToken = token;
            session.waitingForToken = false;
            bot.sendMessage(
              session.chatId,
              `✅ تم التقاط التوكن تلقائياً!\n\nالتوكن: \`${token.slice(0, 8)}...${token.slice(-4)}\`\n\nاستخدم /run لتشغيل البوت 🚀`,
              { parse_mode: "Markdown" }
            );
            // اتصال بـ Expert Option
            connectExpertOption(session);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid session" }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "parse error" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(`✅ WebApp server on :${PORT}`);
});

// ===== صفحة WebApp HTML =====
// تفتح Expert Option في iframe وتلتقط التوكن تلقائياً
const WEBAPP_HTML = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>ExpertBot — تسجيل الدخول</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui; background: #0a0e14; color: #fff; height: 100vh; overflow: hidden; }
#loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 16px; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(16,185,129,0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
#loading p { font-size: 14px; color: #999; }
#eo-frame { width: 100%; height: 100vh; border: none; display: none; }
#overlay { position: fixed; top: 0; left: 0; right: 0; background: #0a0e14; padding: 16px; z-index: 100; display: none; }
#overlay button { background: #10b981; color: #000; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold; width: 100%; cursor: pointer; }
#status { text-align: center; padding: 8px; font-size: 12px; color: #999; }
</style>
</head>
<body>

<div id="loading">
  <div class="spinner"></div>
  <p>جارٍ تحميل Expert Option...</p>
  <p style="font-size:11px;color:#666">سجّل دخولك ثم اضغط الزر الأخضر</p>
</div>

<iframe id="eo-frame" src="https://app.expertoption.com/"></iframe>

<div id="overlay">
  <button onclick="captureToken()">✅ التقط التوكن تلقائياً</button>
  <div id="status">اضغط الزر بعد تسجيل الدخول</div>
</div>

<script>
// إعداد Telegram WebApp
if (window.Telegram && Telegram.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

var chatId = null;
try { chatId = Telegram.WebApp.initDataUnsafe.user.id; } catch(e) {}

// إظهار الـ iframe بعد التحميل
setTimeout(function() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('eo-frame').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
}, 3000);

// التقاط التوكن من Expert Option
function captureToken() {
  document.getElementById('status').innerText = 'جارٍ التقاط التوكن...';

  // محاولة الوصول لـ localStorage في الـ iframe
  // ملاحظة: قد لا يعمل بسبب Same-Origin Policy
  // الحل البديل: فتح Expert Option في نافذة جديدة
  var eoWindow = document.getElementById('eo-frame').contentWindow;

  try {
    // محاولة قراءة localStorage
    var auth = eoWindow.localStorage.getItem('auth');
    var token = null;

    if (auth) {
      try { token = JSON.parse(auth).token; } catch(e) {}
    }

    if (!token) {
      // ابحث في كل localStorage
      for (var i = 0; i < eoWindow.localStorage.length; i++) {
        var k = eoWindow.localStorage.key(i);
        var v = eoWindow.localStorage.getItem(k);
        if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) {
          token = v;
          break;
        }
      }
    }

    if (token) {
      sendTokenToBot(token);
    } else {
      // فتح نافذة جديدة كحل بديل
      document.getElementById('status').innerText = 'تعذّر الالتقاط التلقائي. افتح Expert Option في نافذة جديدة...';
      var w = window.open('https://app.expertoption.com/', '_blank');
      setTimeout(function() {
        alert('في نافذة Expert Option:\\n1. اضغط F12\\n2. Console\\n3. الصق: copy(JSON.stringify(localStorage))\\n4. Enter\\n5. ارجع هنا');
      }, 1000);
    }
  } catch(e) {
    // Same-Origin Policy — استخدم الحل البديل
    document.getElementById('status').innerText = 'افتح Expert Option في نافذة جديدة...';
    window.open('https://app.expertoption.com/', '_blank');
    setTimeout(function() {
      var cmd = 'copy(JSON.stringify(localStorage))';
      navigator.clipboard.writeText(cmd).then(function() {
        alert('تم نسخ الأمر!\\n\\nفي نافذة Expert Option:\\n1. اضغط F12\\n2. Console\\n3. Ctrl+V → Enter\\n4. ارجع هنا والصق النتيجة');
        document.getElementById('status').innerHTML = '<input type="text" id="token-input" placeholder="ألصق النتيجة هنا" style="width:100%;padding:8px;margin-top:8px;background:#1a1a2e;border:1px solid #333;color:#10b981;border-radius:4px"><br><button onclick="manualToken()" style="margin-top:8px">إرسال</button>';
      });
    }, 1000);
  }
}

function sendTokenToBot(token) {
  fetch('${WEBAPP_URL}:3004/capture-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: chatId, token: token })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.ok) {
      document.getElementById('status').innerText = '✅ تم التقاط التوكن! ارجع لتيليجرام';
      document.getElementById('overlay').innerHTML = '<div style="text-align:center;padding:20px"><h2>✅ تم!</h2><p>ارجع لتيليجرام واستخدم /run</p></div>';
      if (Telegram.WebApp) Telegram.WebApp.close();
    } else {
      document.getElementById('status').innerText = '❌ خطأ: ' + (data.error || 'غير معروف');
    }
  }).catch(function(e) {
    document.getElementById('status').innerText = '❌ خطأ في الاتصال';
  });
}

function manualToken() {
  var input = document.getElementById('token-input').value;
  if (!input) return;
  // استخراج التوكن من JSON
  var token = null;
  try {
    var parsed = JSON.parse(input);
    if (parsed.token) token = parsed.token;
    else if (parsed.auth) {
      var auth = typeof parsed.auth === 'string' ? JSON.parse(parsed.auth) : parsed.auth;
      token = auth.token;
    }
  } catch(e) {
    if (/^[a-f0-9]{20,}$/i.test(input)) token = input;
  }
  if (token) {
    sendTokenToBot(token);
  } else {
    alert('تعذّر استخراج التوكن. تأكد من نسخ كل الناتج.');
  }
}
</script>
</body>
</html>`;

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
      waitingForToken: false,
    });
  }

  const session = sessions.get(chatId)!;

  // زر يفتح Expert Option داخل تيليجرام
  bot.sendMessage(
    chatId,
    "🤖 *ExpertBot Live*\n\n" +
      "اضغط الزر بالأسفل لفتح Expert Option داخل تيليجرام.\n" +
      "سجّل دخولك، ثم اضغط «التقط التوكن» — كل شيء تلقائي!\n\n" +
      "أو أرسل التوكن يدوياً: /token <توكن>",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 افتح Expert Option",
              web_app: { url: `${WEBAPP_URL}:3004` },
            },
          ],
        ],
      },
    }
  );
});

bot.onText(/\/token\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;

  let input = match![1].trim();
  let token = null;
  try {
    const parsed = JSON.parse(input);
    if (parsed.token) token = parsed.token;
    else if (parsed.auth) {
      const auth = typeof parsed.auth === "string" ? JSON.parse(parsed.auth) : parsed.auth;
      token = auth.token;
    }
  } catch {
    if (/^[a-f0-9]{20,}$/i.test(input)) token = input;
  }

  if (!token) {
    bot.sendMessage(chatId, "❌ تعذّر استخراج التوكن. استخدم زر «افتح Expert Option» من /start");
    return;
  }

  session.eoToken = token;
  bot.sendMessage(
    chatId,
    `✅ تم استلام التوكن!\n\nاستخدم /run لتشغيل البوت 🚀`,
    { parse_mode: "Markdown" }
  );
  connectExpertOption(session);
});

bot.onText(/\/run/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  if (!session.eoToken) {
    bot.sendMessage(chatId, "❌ اضغط /start ثم «افتح Expert Option» أولاً");
    return;
  }
  if (!session.eoConnected) {
    bot.sendMessage(chatId, "⏳ جارٍ الاتصال... انتظر قليلاً");
    connectExpertOption(session);
    return;
  }
  session.botRunning = true;
  session.tradesCount = 0;
  session.pnl = 0;
  bot.sendMessage(
    chatId,
    `🚀 *البوت يعمل!*\n\nالإستراتيجية: ${session.strategy}\nالرهان: ${session.amount}$\nالمدة: ${session.expiry}ث\n\nللإيقاف: /stop`,
    { parse_mode: "Markdown" }
  );
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
  if (session.botTimer) { clearInterval(session.botTimer); session.botTimer = null; }
  bot.sendMessage(chatId, `⏹ تم الإيقاف\nصفقات: ${session.tradesCount}\nالربح: ${session.pnl.toFixed(2)}$`);
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  bot.sendMessage(
    chatId,
    `📊 متصل: ${session.eoConnected ? "✅" : "❌"}\nيعمل: ${session.botRunning ? "✅" : "❌"}\n` +
    `الإستراتيجية: ${session.strategy}\nالرهان: ${session.amount}$\nالمدة: ${session.expiry}ث\n` +
    `صفقات: ${session.tradesCount}\nالربح: ${session.pnl.toFixed(2)}$`
  );
});

bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  bot.sendMessage(chatId, `💰 الرصيد: ${session.balance.toFixed(2)}$`);
});

bot.onText(/\/strategy\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  const s = match![1].trim().toLowerCase();
  if (["trend", "rsi", "ma_cross", "alligator"].includes(s)) {
    session.strategy = s;
    bot.sendMessage(chatId, `✅ الإستراتيجية: ${s}`);
  }
});

bot.onText(/\/amount\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  const a = Number(match![1].trim());
  if (a > 0) { session.amount = a; bot.sendMessage(chatId, `✅ الرهان: ${a}$`); }
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
    const init = {
      action: "multipleAction",
      message: {
        token: session.eoToken, v: 18, action: "multipleAction",
        message: { token: session.eoToken, actions: [
          { action: "profile", message: null, ns: 2, v: 18, token: session.eoToken },
          { action: "assets", message: { mode: ["vanilla"], subscribeMode: ["vanilla"] }, ns: 3, v: 18, token: session.eoToken },
          { action: "defaultSubscribeCandles", message: { modes: ["vanilla"], timeframes: [0, 5] }, ns: 7, v: 18, token: session.eoToken },
        ]},
      },
      token: session.eoToken, ns: 2,
    };
    sendToExpert(ws, init);
    sendToExpert(ws, { action: "setContext", message: { is_demo: 1 }, token: session.eoToken, ns: 1 });
    session.pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) sendToExpert(ws, { action: "ping", v: 23, message: {} });
    }, 5000);
  });

  ws.on("message", (data: Buffer) => {
    try { handleExpertMessage(session, JSON.parse(data.toString("utf-8"))); } catch {}
  });

  ws.on("error", (err) => {
    session.eoConnected = false;
    bot.sendMessage(session.chatId, `❌ خطأ: ${err.message}`);
  });

  ws.on("close", () => {
    session.eoConnected = false;
    if (session.pingTimer) clearInterval(session.pingTimer);
    if (session.botRunning) {
      bot.sendMessage(session.chatId, "⚠️ انقطع الاتصال. أعد: /run");
      session.botRunning = false;
      if (session.botTimer) clearInterval(session.botTimer);
    }
  });
}

function sendToExpert(ws: WebSocket, msg: any) {
  ws.send(Buffer.from(encodeURIComponent(JSON.stringify(msg)), "utf-8"), { binary: true });
}

function handleExpertMessage(session: UserSession, msg: any) {
  const action = msg?.action;
  if (!action) return;
  if (action === "multipleAction" && msg?.message?.actions) {
    for (const sub of msg.message.actions) handleExpertMessage(session, sub);
    return;
  }
  if (action === "profile") {
    session.balance = msg?.message?.balance ?? session.balance;
    if (!session.eoConnected) {
      session.eoConnected = true;
      bot.sendMessage(session.chatId, `✅ متصل! الرصيد: ${session.balance}$\n\nاستخدم /run 🚀`);
    }
  }
  if (action === "candles" || action === "subscribeCandles") {
    try {
      const candles = msg?.message?.candles || [];
      for (const c of candles) {
        for (const p of (c.periods || [])) {
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
    bot.sendMessage(session.chatId, `📊 ${msg?.message?.type === "call" ? "▲ شراء" : "▼ بيع"}`);
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

  const buyMsg = {
    action: "buyOption",
    message: { type: dir, amount: session.amount, assetid: 240, strike_time: Math.floor(now/1000), expiration_time: roundTime(session.expiry), is_demo: 1, rateIndex: 1 },
    token: session.eoToken, ns: 44,
  };
  sendToExpert(session.eoWs!, buyMsg);
  session.tradesCount++;
  bot.sendMessage(session.chatId, `🎯 ${session.strategy} → ${dir === "call" ? "▲ شراء" : "▼ بيع"} | ${session.amount}$ | #${session.tradesCount}`);
}

// ===== الإستراتيجيات =====
function evaluate(strategy: string, candles: number[]): "call" | "put" | null {
  if (candles.length < 8) return null;
  if (strategy === "ma_cross") {
    const f = sma(candles,3), s = sma(candles,8), pf = sma(candles.slice(0,-1),3), ps = sma(candles.slice(0,-1),8);
    if (!f||!s||!pf||!ps) return null;
    if (pf<=ps && f>s) return "call";
    if (pf>=ps && f<s) return "put";
  } else if (strategy === "rsi") {
    const r = rsi(candles,7);
    if (r==null) return null;
    if (r<30) return "call";
    if (r>70) return "put";
  } else if (strategy === "trend") {
    const l5 = candles.slice(-5);
    const ups = l5.filter((v,i)=>i>0&&v>l5[i-1]).length;
    if (ups>=4) return "call";
    if (ups<=1) return "put";
  } else if (strategy === "alligator") {
    const j=sma(candles,13),t=sma(candles,8),l=sma(candles,5);
    if (!j||!t||!l) return null;
    if (l>t&&t>j) return "call";
    if (l<t&&t<j) return "put";
  }
  return null;
}
function sma(v:number[],p:number):number|null{if(v.length<p)return null;let s=0;for(let i=v.length-p;i<v.length;i++)s+=v[i];return s/p;}
function rsi(v:number[],p=14):number|null{if(v.length<p+1)return null;let g=0,l=0;for(let i=v.length-p;i<v.length;i++){const d=v[i]-v[i-1];if(d>=0)g+=d;else l-=d;}if(l===0)return 100;const r=(g/p)/(l/p);return 100-100/(1+r);}
function roundTime(e:number):number{const n=new Date();const s=Math.floor(n.getTime()/1000)%86400;const r=Math.round((s+e/2)/e)*e;return Math.floor(n.getTime()/1000)-s+r;}
