// scripts/ssh-exec.ts — ينفذ أوامر على VPS عن بعد عبر SSH
import { Client } from "ssh2";

const HOST = "76.13.40.219";
const USER = "root";
const PASS = "Ali@0164569934";

function exec(conn: Client, cmd: string, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    conn.exec(cmd, (e, stream) => {
      if (e) return reject(e);
      stream.on("data", (d: Buffer) => (out += d.toString()));
      stream.stderr.on("data", (d: Buffer) => (err += d.toString()));
      stream.on("close", () => {
        console.log(`\n[${label}]`);
        if (out) console.log(out.trim());
        if (err) console.log("STDERR:", err.trim());
        resolve(out + err);
      });
    });
  });
}

const conn = new Client();
conn
  .on("ready", async () => {
    console.log("✓ متصل بـ VPS");
    try {
      await exec(conn, "uname -a && cat /etc/os-release | head -3", "معلومات النظام");
      await exec(conn, "free -h | head -3 && df -h / | head -2", "الموارد");
      await exec(conn, "which git node bun npm nginx pm2 2>&1 || true", "الأدوات المثبتة");
      conn.end();
    } catch (e) {
      console.error("خطأ:", e);
      conn.end();
    }
  })
  .on("error", (e) => {
    console.error("✗ فشل الاتصال:", e.message);
    process.exit(1);
  })
  .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
