const { Client } = require("ssh2");

const HOST = "76.13.40.219";
const USER = "root";
const PASS = "Ali@0164569934";

function exec(conn, cmd, label, timeout = 180000) {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    console.log(`\n▶ [${label}]`);
    const t = setTimeout(() => {
      console.log(`\n⏱ مهلة`);
      resolve(out + err);
    }, timeout);
    conn.exec(cmd, { pty: true }, (e, stream) => {
      if (e) { clearTimeout(t); return reject(e); }
      stream.on("data", (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
        if (/password/i.test(s) && !stream._pwSent) {
          stream._pwSent = true;
          stream.write(PASS + "\n");
        }
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
  console.log("✓ متصل بـ VPS");
  try {
    await exec(conn, "cd /var/www/expertbot && git pull origin main", "git pull");
    await exec(conn, "cd /var/www/expertbot && bun run build", "build");
    await exec(conn, "pm2 restart expertbot-web", "restart");
    await exec(conn, "pm2 status", "status");
    console.log("\n✅ تم التحديث بنجاح!");
  } catch (e) {
    console.error("خطأ:", e.message);
  }
  conn.end();
})
.on("error", (e) => {
  console.error("✗ فشل الاتصال:", e.message);
  process.exit(1);
})
.connect({
  host: HOST, port: 22, username: USER, password: PASS,
  readyTimeout: 30000, tryKeyboard: true,
  authHandler: ["password", "keyboard-interactive"],
});
