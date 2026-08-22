// popup.js — منطق نافذة الإضافة المنبثقة

const DEFAULT_URL = "http://localhost:81/";
const input = document.getElementById("appUrl");
const openApp = document.getElementById("openApp");
const resetBtn = document.getElementById("resetBtn");
const savedMsg = document.getElementById("savedMsg");

// حمّل الرابط المحفوظ
function loadUrl() {
  chrome.storage?.local.get(["expertbot_app_url"], (res) => {
    const url = (res && res.expertbot_app_url) || DEFAULT_URL;
    input.value = url;
    openApp.href = url;
  });
}

// احفظ الرابط
function saveUrl(url) {
  const clean = (url || "").trim() || DEFAULT_URL;
  chrome.storage?.local.set({ expertbot_app_url: clean }, () => {
    input.value = clean;
    openApp.href = clean;
    // أظهر مؤشر الحفظ
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 1500);
  });
}

input.addEventListener("change", () => saveUrl(input.value));
input.addEventListener("blur", () => saveUrl(input.value));

resetBtn.addEventListener("click", () => {
  chrome.storage?.local.set({ expertbot_app_url: DEFAULT_URL }, () => {
    loadUrl();
    savedMsg.classList.add("show");
    setTimeout(() => savedMsg.classList.remove("show"), 1500);
  });
});

loadUrl();
