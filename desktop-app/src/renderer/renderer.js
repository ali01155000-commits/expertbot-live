// renderer.js — ExpertBot Live desktop app
// يفتح Expert Option، يلتقط التوكن تلقائياً، ويتداول آلياً

const webview = document.getElementById("eo-webview");
const loadingOverlay = document.getElementById("loading-overlay");
const eoStatus = document.getElementById("eo-status");
const botStatusEl = document.getElementById("bot-status");
const logEl = document.getElementById("log");

let botRunning = false;
let botTrades = 0;
let botTimer = null;
let lastSignalTime = 0;
let recentCloses = [];

// === Logging ===
function log(type, message) {
  const time = new Date().toLocaleTimeString("ar-EG", { hour12: false });
  const entry = document.createElement("div");
  entry.className = `entry ${type}`;
  entry.textContent = `${time} ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
}

// === Webview lifecycle ===
webview.addEventListener("did-start-loading", () => {
  loadingOverlay.classList.remove("hidden");
});

webview.addEventListener("did-stop-loading", () => {
  loadingOverlay.classList.add("hidden");
  eoStatus.textContent = "متصل";
  eoStatus.className = "badge emerald";
  log("info", "تم تحميل Expert Option — سجّل دخولك للبدء");
});

webview.addEventListener("did-fail-load", (e) => {
  if (e.errorCode !== -3) {
    log("error", `فشل تحميل Expert Option: ${e.errorDescription}`);
  }
});

// Messages from inject.js
webview.addEventListener("ipc-message", (e) => {
  if (e.channel === "eo-log") {
    log(e.args[0] || "info", e.args[1] || "");
  } else if (e.channel === "eo-balance") {
    document.getElementById("stat-balance").textContent = e.args[0] + " $";
  }
});

// === Execute JS inside Expert Option page ===
async function execInWebview(code) {
  if (!window.expertBot) return null;
  const res = await window.expertBot.executeInWebview(code);
  if (!res.ok) {
    log("error", `خطأ: ${res.error}`);
    return null;
  }
  return res.result;
}

// === Bot actions ===
async function clickTrade(direction) {
  const result = await execInWebview(`
    (function() {
      if (window.__expertBot && window.__expertBot.clickTrade) {
        return window.__expertBot.clickTrade(${JSON.stringify(direction)});
      }
      return { ok: false, error: "inject not ready" };
    })()
  `);
  if (result && result.ok) {
    log("trade", `${direction === "call" ? "▲ شراء" : "▼ بيع"} — تم الضغط`);
    botTrades++;
    document.getElementById("stat-trades").textContent = botTrades;
  } else {
    log("error", `فشل الضغط: ${result?.error || "غير معروف"}`);
  }
}

async function getBalance() {
  const result = await execInWebview(`
    (window.__expertBot && window.__expertBot.getBalance)
      ? window.__expertBot.getBalance() : null
  `);
  if (typeof result === "number") {
    document.getElementById("stat-balance").textContent = result.toFixed(2) + " $";
  }
}

async function getRecentCloses() {
  const result = await execInWebview(`
    (window.__expertBot && window.__expertBot.getRecentCloses)
      ? window.__expertBot.getRecentCloses() : []
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
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

// === Strategy ===
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
    const candles = await getRecentCloses();
    const strategy = document.getElementById("strategy").value;
    const dir = evaluate(strategy, candles);
    if (dir) {
      const now = Date.now();
      if (now - lastSignalTime > 10000) {
        lastSignalTime = now;
        log("signal", `✦ إشارة ${strategy} → ${dir === "call" ? "▲ شراء" : "▼ بيع"}`);
        await clickTrade(dir);
      }
    }
    await getBalance();
  } catch (e) {
    log("error", `خطأ: ${e.message}`);
  }
}

function startBot() {
  if (botRunning) return;
  botRunning = true;
  botTrades = 0;
  document.getElementById("stat-trades").textContent = "0";
  document.getElementById("btn-start").classList.add("hidden");
  document.getElementById("btn-stop").classList.remove("hidden");
  botStatusEl.textContent = "البوت يعمل";
  botStatusEl.className = "badge active";
  log("info", `▶ تشغيل البوت — ${document.getElementById("strategy").value}`);
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

// === UI ===
document.getElementById("btn-start").addEventListener("click", startBot);
document.getElementById("btn-stop").addEventListener("click", stopBot);
document.getElementById("btn-call").addEventListener("click", () => clickTrade("call"));
document.getElementById("btn-put").addEventListener("click", () => clickTrade("put"));

log("info", "مرحباً! سجّل دخولك في Expert Option بالأعلى ثم شغّل البوت");
