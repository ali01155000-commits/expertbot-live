// content.js — يعمل داخل صفحة Expert Option
// يلتقط التوكن تلقائياً + يتصل بـ WebSocket + ينفّذ الصفقات

(function () {
  "use strict";

  let token = null;
  let ws = null;
  let wsConnected = false;
  let botRunning = false;
  let botTimer = null;
  let recentCloses = [];
  let tradesCount = 0;
  let pingTimer = null;

  // استلم الأوامر من الـ popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "getStatus") {
      sendResponse({
        token: token ? token.slice(0, 8) + "..." : null,
        connected: wsConnected,
        botRunning: botRunning,
        trades: tradesCount,
      });
      return true;
    }

    if (msg.type === "startBot") {
      startBot(msg.config);
      sendResponse({ ok: true });
    }

    if (msg.type === "stopBot") {
      stopBot();
      sendResponse({ ok: true });
    }

    if (msg.type === "manualTrade") {
      executeTrade(msg.direction, msg.amount, msg.expiry);
      sendResponse({ ok: true });
    }

    if (msg.type === "grabToken") {
      const t = grabToken();
      sendResponse({ token: t });
    }
  });

  // ابحث عن التوكن تلقائياً عند تحميل الصفحة
  function init() {
    console.log("[ExpertBot] جارٍ البحث عن التوكن...");
    checkToken();
  }

  function checkToken() {
    const t = grabToken();
    if (t) {
      token = t;
      console.log("[ExpertBot] ✅ تم التقاط التوكن!");
      connectWS();
    } else {
      // ابحث كل 3 ثوان
      setTimeout(checkToken, 3000);
    }
  }

  function grabToken() {
    try {
      var auth = localStorage.getItem("auth");
      if (auth) {
        var parsed = JSON.parse(auth);
        if (parsed.token) return parsed.token;
      }
    } catch (e) {}

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var v = localStorage.getItem(localStorage.key(i));
        if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) {
          return v;
        }
      }
    } catch (e) {}

    return null;
  }

  // ===== الاتصال بـ Expert Option =====
  function connectWS() {
    if (!token) return;

    console.log("[ExpertBot] جارٍ الاتصال بـ Expert Option...");

    ws = new WebSocket("wss://fr24g1eu.expertoption.com/");

    ws.onopen = function () {
      console.log("[ExpertBot] ✅ متصل!");
      wsConnected = true;

      // إرسال التهيئة
      sendMsg({
        action: "multipleAction",
        message: {
          token: token,
          actions: [
            { action: "profile", message: null, ns: 2, v: 18, token: token },
            {
              action: "defaultSubscribeCandles",
              message: { modes: ["vanilla"], timeframes: [0, 5] },
              ns: 7,
              v: 18,
              token: token,
            },
          ],
        },
        token: token,
        ns: 2,
      });

      sendMsg({ action: "setContext", message: { is_demo: 1 }, token: token, ns: 1 });

      // ping
      pingTimer = setInterval(function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendMsg({ action: "ping", v: 23, message: {} });
        }
      }, 5000);
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {}
    };

    ws.onerror = function (err) {
      console.error("[ExpertBot] خطأ:", err);
    };

    ws.onclose = function () {
      wsConnected = false;
      console.log("[ExpertBot] انقطع الاتصال");
      if (pingTimer) clearInterval(pingTimer);
      // أعد الاتصال بعد 5 ثوان
      setTimeout(connectWS, 5000);
    };
  }

  function sendMsg(msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    var json = JSON.stringify(msg);
    var encoded = encodeURIComponent(json);
    ws.send(encoded);
  }

  function handleMessage(msg) {
    var action = msg.action;
    if (!action) return;

    if (action === "multipleAction" && msg.message && msg.message.actions) {
      for (var i = 0; i < msg.message.actions.length; i++) {
        handleMessage(msg.message.actions[i]);
      }
      return;
    }

    if (action === "profile") {
      var balance = msg.message ? msg.message.balance : 0;
      console.log("[ExpertBot] الرصيد: " + balance);
    }

    if (action === "candles" || action === "subscribeCandles") {
      try {
        var candles = msg.message ? msg.message.candles : [];
        for (var i = 0; i < candles.length; i++) {
          var periods = candles[i].periods || [];
          for (var j = 0; j < periods.length; j++) {
            var arr = periods[j][1];
            if (arr && arr.length > 0) {
              var last = arr[arr.length - 1];
              if (last && last.length >= 4) {
                recentCloses.push(last[3]);
                if (recentCloses.length > 50) recentCloses.shift();
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  // ===== البوت =====
  function startBot(config) {
    botRunning = true;
    console.log("[ExpertBot] ▶ تشغيل البوت:", config);

    botTimer = setInterval(function () {
      if (!botRunning || !wsConnected) return;
      if (recentCloses.length < 8) return;

      var dir = evaluate(config.strategy, recentCloses);
      if (!dir) return;

      var now = Date.now();
      if (now - (startBot.lastSignal || 0) < 15000) return;
      startBot.lastSignal = now;

      executeTrade(dir, config.amount, config.expiry);
    }, 5000);
  }

  function stopBot() {
    botRunning = false;
    if (botTimer) clearInterval(botTimer);
    console.log("[ExpertBot] ■ تم إيقاف البوت. صفقات: " + tradesCount);
  }

  function executeTrade(direction, amount, expiry) {
    if (!wsConnected || !token) return;

    var strikeTime = Math.floor(Date.now() / 1000);
    var expTime = strikeTime + expiry;

    sendMsg({
      action: "buyOption",
      message: {
        type: direction,
        amount: amount,
        assetid: 240,
        strike_time: strikeTime,
        expiration_time: expTime,
        is_demo: 1,
        rateIndex: 1,
      },
      token: token,
      ns: 44,
    });

    tradesCount++;
    var emoji = direction === "call" ? "▲" : "▼";
    var label = direction === "call" ? "شراء" : "بيع";
    console.log("[ExpertBot] 🎯 صفقة: " + emoji + " " + label + " | " + amount + "$ | " + expiry + "ث | #" + tradesCount);
  }

  // ===== الإستراتيجيات =====
  function evaluate(strategy, candles) {
    if (strategy === "trend") {
      var last5 = candles.slice(-5);
      var ups = 0;
      for (var i = 1; i < last5.length; i++) {
        if (last5[i] > last5[i - 1]) ups++;
      }
      if (ups >= 4) return "call";
      if (ups <= 1) return "put";
    }

    if (strategy === "rsi") {
      var r = rsi(candles, 7);
      if (r === null) return null;
      if (r < 30) return "call";
      if (r > 70) return "put";
    }

    if (strategy === "ma_cross") {
      var fast = sma(candles, 3);
      var slow = sma(candles, 8);
      var prevFast = sma(candles.slice(0, -1), 3);
      var prevSlow = sma(candles.slice(0, -1), 8);
      if (fast === null || slow === null || prevFast === null || prevSlow === null) return null;
      if (prevFast <= prevSlow && fast > slow) return "call";
      if (prevFast >= prevSlow && fast < slow) return "put";
    }

    if (strategy === "alligator") {
      var jaw = sma(candles, 13);
      var teeth = sma(candles, 8);
      var lips = sma(candles, 5);
      if (jaw === null || teeth === null || lips === null) return null;
      if (lips > teeth && teeth > jaw) return "call";
      if (lips < teeth && teeth < jaw) return "put";
    }

    return null;
  }

  function sma(values, period) {
    if (values.length < period) return null;
    var sum = 0;
    for (var i = values.length - period; i < values.length; i++) sum += values[i];
    return sum / period;
  }

  function rsi(values, period) {
    if (values.length < period + 1) return null;
    var gains = 0, losses = 0;
    for (var i = values.length - period; i < values.length; i++) {
      var diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    var rs = gains / period / (losses / period);
    return 100 - 100 / (1 + rs);
  }

  // ابدأ
  init();
})();
