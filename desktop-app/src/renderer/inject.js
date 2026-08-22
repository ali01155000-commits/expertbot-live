// inject.js — يُحقن داخل صفحة app.expertoption.com (في الـ webview)
// يوفّر API للبوت: clickTrade(direction), getBalance(), getCurrentPrice(), getRecentCloses()
//
// هذا هو السكربت الذي يضغط فعلياً على أزرار Buy/Sell داخل الصفحة.

const { ipcRenderer } = (() => {
  try {
    return require("electron");
  } catch {
    return { ipcRenderer: null };
  }
})();

function sendToBot(channel, ...args) {
  try {
    if (ipcRenderer) ipcRenderer.sendToHost(channel, ...args);
  } catch {}
}

// === Helper: find an element by multiple selectors ===
function findElement(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {}
  }
  return null;
}

// === Helper: simulate a real click (mousedown + mouseup + click) ===
function realClick(el) {
  if (!el) return false;
  try {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    return true;
  } catch (e) {
    try {
      el.click();
      return true;
    } catch {
      return false;
    }
  }
}

// === ExpertBot API exposed to the renderer (via webview.executeJavaScript) ===
window.__expertBot = {
  /**
   * Click the Buy (CALL) or Sell (PUT) button on Expert Option.
   * Tries multiple selectors since the UI changes between versions.
   */
  clickTrade(direction) {
    // direction = "call" (buy/up) or "put" (sell/down)
    const isCall = direction === "call";

    // Try various button selectors used by Expert Option over time
    const callSelectors = [
      '[data-testid="call-button"]',
      '[data-test="buy-call"]',
      'button.call-button',
      '.trade-button.call',
      '.button-call',
      'button[aria-label*="call" i]',
      'button[aria-label*="buy" i]',
      'button[aria-label*="up" i]',
      // Fallback: find buttons by text content
    ];
    const putSelectors = [
      '[data-testid="put-button"]',
      'button.put-button',
      '.trade-button.put',
      '.button-put',
      'button[aria-label*="put" i]',
      'button[aria-label*="sell" i]',
      'button[aria-label*="down" i]',
    ];

    let clicked = false;
    const selectors = isCall ? callSelectors : putSelectors;
    for (const sel of selectors) {
      const el = findElement([sel]);
      if (el) {
        clicked = realClick(el);
        if (clicked) break;
      }
    }

    // Last resort: scan all buttons for matching text
    if (!clicked) {
      const keywords = isCall
        ? ["call", "buy", "up", "أعلى", "شراء", "صعود"]
        : ["put", "sell", "down", "أسفل", "بيع", "هبوط"];
      const buttons = document.querySelectorAll("button, [role=button], .btn, .button");
      for (const btn of buttons) {
        const text = (btn.textContent || "").toLowerCase().trim();
        if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
          clicked = realClick(btn);
          if (clicked) break;
        }
      }
    }

    if (clicked) {
      sendToBot("eo-log", "trade", `تم الضغط على زر ${direction} داخل Expert Option`);
    } else {
      sendToBot("eo-log", "error", `لم يُعثر على زر ${direction} — تأكد أنك في صفقة تداول`);
    }
    return { ok: clicked, direction };
  },

  /**
   * Read the current account balance from the page.
   */
  getBalance() {
    const selectors = [
      '[data-testid="balance"]',
      '.balance-value',
      '.account-balance',
      '.user-balance',
      '[class*="balance" i]',
    ];
    for (const sel of selectors) {
      const el = findElement([sel]);
      if (el) {
        const text = (el.textContent || "").replace(/[^0-9.,]/g, "").replace(/,/g, "");
        const num = parseFloat(text);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  },

  /**
   * Read the current price of the selected asset.
   */
  getCurrentPrice() {
    const selectors = [
      '[data-testid="current-price"]',
      '.current-price',
      '.price-value',
      '.asset-price',
      '[class*="price" i]:not([class*="prices" i])',
    ];
    for (const sel of selectors) {
      const el = findElement([sel]);
      if (el) {
        const text = (el.textContent || "").replace(/[^0-9.]/g, "");
        const num = parseFloat(text);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return null;
  },

  /**
   * Get recent closing prices for indicator calculations.
   * Reads from the chart canvas or DOM-based candles if available.
   */
  getRecentCloses() {
    // Try to read from any exposed chart data
    try {
      if (window.__eoChartData && Array.isArray(window.__eoChartData)) {
        return window.__eoChartData.slice(-50);
      }
    } catch {}

    // Fallback: poll the current price a few times (basic)
    const price = this.getCurrentPrice();
    if (price) {
      if (!window.__eoCloses) window.__eoCloses = [];
      window.__eoCloses.push(price);
      if (window.__eoCloses.length > 50) window.__eoCloses.shift();
      return window.__eoCloses.slice();
    }
    return [];
  },

  /** Report status back to the bot panel. */
  ping() {
    return {
      ok: true,
      url: window.location.href,
      title: document.title,
      ts: Date.now(),
    };
  },
};

// Hook chart data if Expert Option exposes it (varies by version)
try {
  const origDefineProperty = Object.defineProperty;
  // Watch for global chart data
  setInterval(() => {
    try {
      // Some versions expose chart data on window.__chart or similar
      const candidates = ["__chart", "__candles", "__chartData", "__eoCandles"];
      for (const key of candidates) {
        if (window[key] && Array.isArray(window[key])) {
          window.__eoChartData = window[key];
          break;
        }
      }
    } catch {}
  }, 2000);
} catch {}

sendToBot("eo-log", "info", "🤖 ExpertBot inject جاهز — البوت يمكنه التحكم بالصفحة");
