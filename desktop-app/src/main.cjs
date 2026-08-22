// src/main.cjs — Electron main process
// Creates the app window and loads the renderer (which embeds Expert Option).

const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "ExpertBot Live",
    backgroundColor: "#0a0e14",
    webPreferences: {
      // Required for <webview> to work
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  // Bypass X-Frame-Options for the webview (so Expert Option can be embedded).
  // This is the KEY trick that makes the embedded browser work — web browsers
  // can't do this, but Electron can (it controls the HTTP stack).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    // Strip frame-busting headers so Expert Option loads inside <webview>
    delete headers["x-frame-options"];
    delete headers["X-Frame-Options"];
    delete headers["content-security-policy"];
    delete headers["Content-Security-Policy"];
    callback({ cancel: false, responseHeaders: headers });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: let the bot panel call into the webview
ipcMain.handle("webview-execute", async (event, code) => {
  const webview = event.sender;
  try {
    const result = await webview.executeJavaScript(code, true);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
