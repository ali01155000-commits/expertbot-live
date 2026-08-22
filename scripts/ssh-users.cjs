const { Client } = require("ssh2");

const users = ["root", "ubuntu", "admin", "expertbot", "user"];
const PASS = "Ali@0164569934";

function tryAuth(user) {
  return new Promise((resolve) => {
    const conn = new Client();
    let done = false;
    const t = setTimeout(() => {
      if (!done) { done = true; conn.end(); resolve({ user, ok: false, err: "timeout" }); }
    }, 8000);
    conn.on("ready", () => {
      if (!done) {
        done = true; clearTimeout(t);
        conn.exec("whoami", (e, s) => {
          if (e) { conn.end(); resolve({ user, ok: true }); return; }
          let out = "";
          s.on("data", d => out += d.toString());
          s.on("close", () => { conn.end(); resolve({ user, ok: true, whoami: out.trim() }); });
        });
      }
    });
    conn.on("error", (e) => {
      if (!done) { done = true; clearTimeout(t); resolve({ user, ok: false, err: e.message }); }
    });
    conn.connect({
      host: "76.13.40.219",
      port: 22,
      username: user,
      password: PASS,
      readyTimeout: 7000,
    });
  });
}

(async () => {
  console.log("اختبار كلمة المرور Ali@0164569934 مع مستخدمين مختلفين:\n");
  for (const u of users) {
    const r = await tryAuth(u);
    if (r.ok) {
      console.log(`✓ "${u}" — نجح! (whoami: ${r.whoami})`);
      break;
    } else {
      console.log(`✗ "${u}" — فشل`);
    }
  }
})();
