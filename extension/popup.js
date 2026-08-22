// popup.js — منطق نافذة الإضافة المنبثقة

const input = document.getElementById("appUrl");

// حمّل الرابط المحفوظ
chrome.storage?.local.get(["expertbot_app_url"], (res) => {
  if (res && res.expertbot_app_url) {
    input.value = res.expertbot_app_url;
  } else {
    input.placeholder = "http://localhost:81/";
  }
});

// احفظ الرابط عند التغيير
input.addEventListener("change", () => {
  const v = input.value.trim();
  chrome.storage?.local.set({
    expertbot_app_url: v || "http://localhost:81/",
  });
});
