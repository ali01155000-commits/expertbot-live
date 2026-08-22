const { Client } = require("ssh2");

const HOST = "76.13.40.219";
const USER = "root";
const PASS = "Ali@0164569934";

function exec(conn, cmd, label, timeout = 300000) {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    console.log(`\n▶ [${label}]`);
    const t = setTimeout(() => {
      console.log(`\n⏱ [${label}] مهلة`);
      resolve(out + err);
    }, timeout);
    conn.exec(cmd, { pty: false }, (e, stream) => {
      if (e) { clearTimeout(t); return reject(e); }
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on("data", (d) => {
        const s = d.toString();
        err += s;
        process.stderr.write(s);
      });
      stream.on("close", (code) => {
        clearTimeout(t);
        console.log(`\n■ [${label}] exit=${code}`);
        resolve(out + err);
      });
    });
  });
}

const conn = new Client();
conn.on("ready", async () => {
  console.log("✓ متصل بـ VPS بنجاح!");
  try {
    await exec(conn, "uname -a && cat /etc/os-release | head -2", "معلومات النظام", 15000);
    await exec(conn, "free -h | head -2 && df -h / | tail -1", "الموارد", 15000);
    await exec(conn, "which git node npm nginx pm2 2>&1 || echo 'some-missing'", "الأدوات", 15000);
    console.log("\n✅ الاتصال ناجح — جاهز للنشر");
  } catch (e) {
    console.error("خطأ:", e.message);
  }
  conn.end();
})
.on("error", (e) => {
  console.error("✗ فشل الاتصال:", e.message);
  process.exit(1);
})
.on("keyboard-interactive", (_name, _instr, _lang, prompts, finish) => {
  // Some servers send password prompt via keyboard-interactive
  finish([PASS]);
})
.connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 30000,
  tryKeyboard: true,
  authHandler: (methods, cb) => {
    // Try password first, then keyboard-interactive
    if (methods.includes("password")) {
      return cb(null, { type: "password", password: PASS });
    }
    if (methods.includes("keyboard-interactive")) {
      return cb(null, { type: "keyboard-interactive", prompt: (_p, finish) => finish([PASS]) });
    }
    return cb(null, false);
  },
});
