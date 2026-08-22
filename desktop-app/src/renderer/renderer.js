// renderer.js — ExpertBot Live desktop app logic
// Controls the <webview> (embedded Expert Option) and runs the bot.

const webview = document.getElementById("eo-webview");
const loadingOverlay = document.getElementById("loading-overlay");
const eoStatus = document.getElementById("eo-status");
const botStatusEl = document.getElementById("bot-status");
const balanceEl = document.getElementById("balance");
const logEl = document.getElementById("log");

// Bot state
let botRunning = false;
let botTrades = 0;
let botPnl = 0;
let botTimer = null;
let lastSignalTime = 0;

// === Logging ===
function log(type, message) {
  const time = new Date().toLocaleTimeString("ar-EG", { hour12: false });
  const entry = document.createElement("div");
  entry.className = `entry ${type}`;
  entry.textContent = `${time} ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  // Keep last 200 entries
  while (logEl.children.length > 200) logEl.removeChild(logEl.firstChild);
}

// === Webview lifecycle ===
webview.addEventListener("did-start-loading", () => {
  loadingOverlay.classList.remove("hidden");
});

webview.addEventListener("did-stop-loading", () => {
  loadingOverlay.classList.add("hidden");
  eoStatus.textContent = "متصل";
  eoStatus.className = "badge emerald";
  log("info", "تم تحميل منصة Expert Option — سجّل دخولك للبدء");
});

webview.addEventListener("did-fail-load", (e) => {
  if (e.errorCode !== -3) {
    log("error", `فشل تحميل Expert Option: ${e.errorDescription}`);
    eoStatus.textContent = "خطأ";
    eoStatus.className = "badge warn";
  }
});

// Messages from the inject script (inside Expert Option page)
webview.addEventListener("ipc-message", (e) => {
  if (e.channel === "eo-log") {
    log(e.args[0] || "info", e.args[1] || "");
  } else if (e.channel === "eo-balance") {
    balanceEl.textContent = `الرصيد: ${e.args[0]} $`;
  }
});

// === Execute JS inside the webview (via preload bridge) ===
async function execInWebview(code) {
  if (!window.expertBot) {
    log("error", "preload bridge غير متاح");
    return null;
  }
  const res = await window.expertBot.executeInWebview(code);
  if (!res.ok) {
    log("error", `webview exec error: ${res.error}`);
    return null;
  }
  return res.result;
}

// === Bot actions: click Buy/Sell inside Expert Option ===
async function clickTrade(direction) {
  // The inject.js exposes window.__expertBot.clickTrade(direction)
  // which finds and clicks the actual Buy/Sell button on the page.
  const result = await execInWebview(`
    (function() {
      if (window.__expertBot && window.__expertBot.clickTrade) {
        return window.__expertBot.clickTrade(${JSON.stringify(direction)});
      }
      return { ok: false, error: "inject not ready" };
    })()
  `);
  if (result && result.ok) {
    log("trade", `${direction === "call" ? "▲ شراء" : "▼ بيع"} — تم الضغط على الزر`);
  } else {
    log("error", `فشل الضغط على زر ${direction}: ${result?.error || "غير معروف"}`);
  }
  return result;
}

async function getBalance() {
  const result = await execInWebview(`
    (window.__expertBot && window.__expertBot.getBalance) ? window.__expertBot.getBalance() : null
  `);
  if (typeof result === "number") {
    balanceEl.textContent = `الرصيد: ${result.toFixed(2)} $`;
    return result;
  }
  return null;
}

async function getCurrentPrice() {
  const result = await execInWebview(`
    (window.__expertBot && window.__expertBot.getCurrentPrice) ? window.__expertBot.getCurrentPrice() : null
  `);
  return typeof result === "number" ? result : null;
}

async function getRecentCandles() {
  const result = await execInWebview(`
    (window.__expertBot && window.__expertBot.getRecentCloses) ? window.__expertBot.getRecentCloses() : []
  `);
  return Array.isArray(result) ? result : [];
}

// === Indicators ===
function sma(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

// === Strategy evaluation ===
function evaluate(strategy, candles) {
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

// === Bot loop ===
async function botLoop() {
  if (!botRunning) return;
  try {
    const candles = await getRecentCandles();
    const strategy = document.getElementById("strategy").value;
    const dir = evaluate(strategy, candles);
    if (dir) {
      const now = Date.now();
      const cooldown = 10000;
      if (now - lastSignalTime > cooldown) {
        lastSignalTime = now;
        log("signal", `✦ إشارة ${strategy} → ${dir === "call" ? "▲ شراء" : "▼ بيع"}`);
        const result = await clickTrade(dir);
        if (result && result.ok) {
          botTrades++;
          document.getElementById("stat-trades").textContent = botTrades;
          log("trade", `🤖 نُفّذت صفقة ${dir} (عبر الضغط على زر Expert Option)`);
        }
        const maxTrades = parseInt(document.getElementById("max-trades").value) || 0;
        if (maxTrades > 0 && botTrades >= maxTrades) {
          log("info", `تم الوصول لأقصى عدد صفقات (${maxTrades}) — إيقاف البوت`);
          stopBot();
          return;
        }
      }
    }
    await getBalance();
  } catch (e) {
    log("error", `خطأ في حلقة البوت: ${e.message}`);
  }
}

function startBot() {
  if (botRunning) return;
  botRunning = true;
  botTrades = 0;
  botPnl = 0;
  document.getElementById("stat-trades").textContent = "0";
  document.getElementById("stat-pnl").textContent = "0.00$";
  document.getElementById("btn-start").classList.add("hidden");
  document.getElementById("btn-stop").classList.remove("hidden");
  botStatusEl.textContent = "البوت يعمل";
  botStatusEl.className = "badge active";
  log("info", `▶ تشغيل البوت — إستراتيجية ${document.getElementById("strategy").value}`);
  botTimer = setInterval(botLoop, 3000);
}

function stopBot() {
  botRunning = false;
  if (botTimer) clearInterval(botTimer);
  botTimer = null;
  document.getElementById("btn-start").classList.remove("hidden");
  document.getElementById("btn-stop").classList.add("hidden");
  botStatusEl.textContent = "البوت متوقف";
  botStatusEl.className = "badge";
  log("info", "■ تم إيقاف البوت");
}

// === UI bindings ===
document.getElementById("btn-start").addEventListener("click", startBot);
document.getElementById("btn-stop").addEventListener("click", stopBot);
document.getElementById("btn-call").addEventListener("click", () => clickTrade("call"));
document.getElementById("btn-put").addEventListener("click", () => clickTrade("put"));

document.getElementById("btn-reload").addEventListener("click", () => {
  webview.reload();
});

document.getElementById("btn-toggle-panel").addEventListener("click", () => {
  document.getElementById("bot-panel").classList.toggle("hidden");
});

// Initial log
log("info", "مرحباً بك في ExpertBot Live — سجّل دخولك في Expert Option بالأعلى");
