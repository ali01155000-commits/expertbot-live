// background.js — service worker للإضافة
// يستقبل رسائل من content.js ويفتح تبويب التطبيق

// رسالة من content.js لفتح التطبيق
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "open-app" && msg.url) {
    chrome.tabs.create({ url: msg.url, active: true });
    sendResponse({ ok: true });
  }
  return true;
});

// رسالة من التطبيق (externally_connectable) للتأكد من تثبيت الإضافة
chrome.runtime.onMessageExternal.addListener(
  (msg, sender, sendResponse) => {
    if (msg && msg.type === "ping") {
      sendResponse({ installed: true, version: "1.0.0" });
    }
    // التطبيق يطلب التوكن المحفوظ (إن وُجد من جلسة سابقة)
    if (msg && msg.type === "get-token") {
      chrome.storage.local.get(["expertbot_token"], (res) => {
        sendResponse({ token: res?.expertbot_token || null });
      });
      return true; // async response
    }
    return true;
  }
);

// عند تثبيت الإضافة، افتح صفحة الترحيب
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "http://localhost:81/?installed=1",
      active: true,
    });
  }
});
