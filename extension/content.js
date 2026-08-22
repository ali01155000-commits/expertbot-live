// content.js — يعمل على app.expertoption.com
// يلتقط توكن الجلسة تلقائياً ويفتح تطبيق ExpertBot Live

(function () {
  "use strict";

  // أعلم التطبيق أن الإضافة مُثبّتة (إذا كان مفتوحاً في تبويب آخر)
  // عن طريق postMessage — لكن cross-origin لن يصل. لذا نستخدم chrome.storage
  // + نشير إلى التطبيق أن يفحص عبر محاولة إرسال رسالة.
  // الطريقة الأبسط: عندما يفتح التطبيق، يطلب من الإضافة عبر external API.

  // اقرأ رابط التطبيق من إعدادات الإضافة (مع افتراضي)
  const DEFAULT_APP_URL = "http://localhost:81/";

  let captured = false;
  let appUrl = DEFAULT_APP_URL;

  // حمّل رابط التطبيق المخصص من chrome.storage
  chrome.storage?.local.get(["expertbot_app_url"], (res) => {
    if (res && res.expertbot_app_url) {
      appUrl = res.expertbot_app_url;
    }
    start();
  });

  function start() {
    // حاول التقاط التوكن فوراً (لو المستخدم مسجل دخول مسبقاً)
    const t = grabToken();
    if (t) {
      sendToApp(t);
      return;
    }
    // لو لم يُعثر على توكن، راقب localStorage والـ WebSocket حتى يسجل المستخدم دخوله
    watchForLogin();
  }

  /**
   * ابحث عن التوكن في:
   *  1. localStorage (مفاتيح متعددة محتملة)
   *  2. cookies
   *  3. hook على WebSocket.send (Expert Option يرسل التوكن في كل رسالة)
   */
  function grabToken() {
    // 1. ابحث في localStorage عن أي قيمة بصيغة hex بطول 20-80
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);
        if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) {
          return v;
        }
      }
      // مفاتيح محددة يعرفها بروتوكول Expert Option
      const auth = localStorage.getItem("auth");
      if (auth) {
        try {
          const parsed = JSON.parse(auth);
          if (parsed && parsed.token && /^[a-f0-9]{20,}$/i.test(parsed.token)) {
            return parsed.token;
          }
        } catch {}
      }
    } catch {}

    // 2. ابحث في cookies
    try {
      const m = document.cookie.match(/(?:^|;\s*)([a-f0-9]{24,})/i);
      if (m && m[1]) return m[1];
    } catch {}

    return null;
  }

  /**
   * راقب localStorage للتعرف على تسجيل الدخول + hook على WebSocket.
   */
  function watchForLogin() {
    // راقب تغييرات localStorage
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      if (captured) {
        clearInterval(pollInterval);
        return;
      }
      pollCount++;
      const t = grabToken();
      if (t) {
        clearInterval(pollInterval);
        sendToApp(t);
      }
      // توقف بعد 5 دقائق (300 فحص × 1 ثانية)
      if (pollCount > 300) clearInterval(pollInterval);
    }, 1000);

    // hook على WebSocket — Expert Option يرسل التوكن في أول رسالة
    if (!window.__eoHookInstalled) {
      window.__eoHookInstalled = true;
      const origSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        if (!captured) {
          try {
            const s =
              typeof data === "string"
                ? data
                : new TextDecoder().decode(data);
            const m = s.match(/"token"\s*:\s*"([a-f0-9]{20,})"/);
            if (m && m[1]) {
              sendToApp(m[1]);
            }
          } catch {}
        }
        return origSend.apply(this, arguments);
      };
    }
  }

  /**
   * أرسل التوكن لتطبيق ExpertBot Live.
   *  - لو التطبيق مفتوح في تبويب آخر: أرسل عبر postMessage
   *  - وإلا: افتح التطبيق في تبويب جديد مع ?token=
   */
  function sendToApp(token) {
    if (captured) return;
    captured = true;
    console.log("[ExpertBot] تم التقاط الجلسة، جارٍ فتح التطبيق…");

    // خزّن التوكن في chrome.storage كنسخة احتياطية
    chrome.storage?.local.set({ expertbot_token: token });

    const urlWithToken = appUrl + (appUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);

    // أرسل postMessage لكل النوافذ (لو التطبيق مفتوح)
    try {
      window.postMessage(
        { type: "eo-token", token, source: "expertbot-extension" },
        appUrl
      );
    } catch {}

    // افتح التطبيق في تبويب جديد
    try {
      chrome.runtime.sendMessage({
        type: "open-app",
        url: urlWithToken,
      });
    } catch {
      // fallback: افتح مباشرة
      window.open(urlWithToken, "_blank");
    }

    // أظهر إشعاراً على الصفحة
    showNotification("✓ تم ربط ExpertBot Live — التطبيق يفتح الآن…");
  }

  function showNotification(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;top:16px;right:16px;z-index:999999;" +
      "background:#10b981;color:#000;padding:12px 18px;border-radius:10px;" +
      "font-family:system-ui,sans-serif;font-size:14px;font-weight:600;" +
      "box-shadow:0 8px 30px rgba(16,185,129,0.4);" +
      "animation:eobot-slide-in 0.3s ease;";
    const style = document.createElement("style");
    style.textContent =
      "@keyframes eobot-slide-in{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}";
    document.head.appendChild(style);
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.4s, transform 0.4s";
      el.style.opacity = "0";
      el.style.transform = "translateX(120%)";
      setTimeout(() => el.remove(), 400);
    }, 4000);
  }
})();
