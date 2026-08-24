// background.js — service worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "openExpertOption") {
    chrome.tabs.create({ url: "https://app.expertoption.com/" });
    sendResponse({ ok: true });
  }

  if (msg.type === "sendToContent") {
    chrome.tabs.query({ url: "https://app.expertoption.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, msg.data, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: "Expert Option غير مفتوح" });
      }
    });
    return true;
  }
});
