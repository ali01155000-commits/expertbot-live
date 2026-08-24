// main.cjs — متصفح ExpertBot المخصص
// يفتح Expert Option + يلتقط التوكن تلقائياً + ينقله للبوت

const { app, BrowserWindow, session } = require("electron");
const path = require("path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "ExpertBot Live — المتصفح المخصص",
    backgroundColor: "#0a0e14",
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // إزالة X-Frame-Options و CSP — هذا هو السر!
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    delete headers["x-frame-options"];
    delete headers["X-Frame-Options"];
    delete headers["content-security-policy"];
    delete headers["Content-Security-Policy"];
    callback({ cancel: false, responseHeaders: headers });
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: تنفيذ كود داخل webview
const { ipcMain } = require("electron");
ipcMain.handle("webview-execute", async (event, code) => {
  try {
    const result = await event.sender.executeJavaScript(code, true);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
