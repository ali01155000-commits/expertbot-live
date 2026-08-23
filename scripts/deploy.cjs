const { Client } = require("ssh2");

const HOST = "76.13.40.219";
const USER = "root";
const PASS = "Ali@0164569934";

function exec(conn, cmd, label, timeout = 120000) {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    console.log(`\n▶ [${label}]`);
    conn.exec(cmd, { pty: true }, (e, stream) => {
      if (e) return reject(e);
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        // Show progress live
        process.stdout.write(s);
        // Auto-answer password prompts if any (sudo)
        if (/password/i.test(s) && !stream._pwSent) {
          stream._pwSent = true;
          stream.write(PASS + "\n");
        }
      });
      stream.stderr.on("data", (d) => { err += d.toString(); });
      stream.on("close", (code) => {
        console.log(`\n■ [${label}] exit=${code}`);
        resolve(out + err);
      });
    });
  });
}

const conn = new Client();
conn.on("ready", async () => {
  console.log("✓ متصل بـ VPS بنجاح");
  try {
    // Step 1: system info
    await exec(conn, "uname -a; cat /etc/os-release | head -2; free -h | head -2; df -h / | tail -1", "معلومات النظام");

    // Step 2: check existing tools
    await exec(conn, "which git node npm nginx 2>&1 || echo 'some missing'", "الأدوات الموجودة");

    conn.end();
    console.log("\n✓ اكتمل الفحص");
  } catch (e) {
    console.error("خطأ:", e.message);
    conn.end();
  }
})
.on("error", (e) => {
  console.error("✗ فشل الاتصال:", e.message);
  console.error("\nالأسباب المحتملة:");
  console.error("1. كلمة المرور خاطئة");
  console.error("2. الـ VPS يستخدم مفاتيح SSH فقط (PasswordAuthentication no)");
  console.error("3. منفذ SSH ليس 22");
  console.error("4. الـ VPS محمي بجدار ناري");
  process.exit(1);
})
.connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 25000,
  tryKeyboard: true,
  // Some servers need this for password auth
  authHandler: ["password", "keyboard-interactive"],
});
