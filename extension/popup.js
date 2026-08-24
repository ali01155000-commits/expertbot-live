// popup.js — لوحة تحكم البوت

const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const btnCall = document.getElementById("btn-call");
const btnPut = document.getElementById("btn-put");
const btnOpenEO = document.getElementById("open-eo");
const tradesEl = document.getElementById("trades");
const balanceEl = document.getElementById("balance-display");

// تحديث الحالة كل ثانية
function updateStatus() {
  chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
    if (tabs.length === 0) {
      statusEl.className = "status disconnected";
      statusText.textContent = "غير متصل — افتح Expert Option";
      btnStart.disabled = true;
      btnCall.disabled = true;
      btnPut.disabled = true;
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { type: "getStatus" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        statusEl.className = "status disconnected";
        statusText.textContent = "جارٍ التحميل...";
        btnStart.disabled = true;
        return;
      }

      if (response.connected) {
        statusEl.className = "status connected";
        statusText.textContent = "✅ متصل بـ Expert Option";
        btnStart.disabled = false;
        btnCall.disabled = false;
        btnPut.disabled = false;
        tradesEl.textContent = response.trades || 0;
      } else if (response.token) {
        statusEl.className = "status disconnected";
        statusText.textContent = "⏳ جارٍ الاتصال...";
        btnStart.disabled = true;
      } else {
        statusEl.className = "status disconnected";
        statusText.textContent = "⏳ سجّل دخولك في Expert Option";
        btnStart.disabled = true;
      }
    });
  });
}

// فتح Expert Option
btnOpenEO.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://app.expertoption.com/" });
});

// تشغيل البوت
btnStart.addEventListener("click", () => {
  const config = {
    strategy: document.getElementById("strategy").value,
    amount: parseInt(document.getElementById("amount").value),
    expiry: parseInt(document.getElementById("expiry").value),
  };

  chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "startBot", config: config });
      btnStart.style.display = "none";
      btnStop.style.display = "block";
    }
  });
});

// إيقاف البوت
btnStop.addEventListener("click", () => {
  chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "stopBot" });
      btnStart.style.display = "block";
      btnStop.style.display = "none";
    }
  });
});

// تداول يدوي
btnCall.addEventListener("click", () => {
  const amount = parseInt(document.getElementById("amount").value);
  const expiry = parseInt(document.getElementById("expiry").value);
  chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "manualTrade",
        direction: "call",
        amount: amount,
        expiry: expiry,
      });
    }
  });
});

btnPut.addEventListener("click", () => {
  const amount = parseInt(document.getElementById("amount").value);
  const expiry = parseInt(document.getElementById("expiry").value);
  chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "manualTrade",
        direction: "put",
        amount: amount,
        expiry: expiry,
      });
    }
  });
});

// حدّث كل ثانية
updateStatus();
setInterval(updateStatus, 1000);
