// src/preload.cjs — runs in the renderer with Node access.
// Exposes a safe bridge between the bot panel UI and the webview.

const { ipcRenderer } = require("electron");

window.expertBot = {
  /**
   * Execute JavaScript inside the Expert Option <webview> and return the result.
   * Used by the bot to click Buy/Sell buttons, read balance, etc.
   */
  executeInWebview: (code) => ipcRenderer.invoke("webview-execute", code),

  /** Platform info for the renderer. */
  platform: process.platform,
  versions: process.versions,
};
