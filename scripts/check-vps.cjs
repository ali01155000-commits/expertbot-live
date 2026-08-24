const { Client } = require("ssh2");
const conn = new Client();
conn.on("ready", async () => {
  function exec(cmd) {
    return new Promise((resolve) => {
      conn.exec(cmd, (e, stream) => {
        let out = "";
        stream.on("data", d => out += d.toString());
        stream.stderr.on("data", d => out += d.toString());
        stream.on("close", () => resolve(out));
      });
    });
  }
  
  // Check if the invite link code exists in the built files
  const result = await exec("grep -r 'رابط الدعوة' /var/www/expertbot/.next/server/ 2>/dev/null | head -3");
  console.log("_invite link in build:", result.trim() || "NOT FOUND");
  
  // Check source
  const src = await exec("grep -c 'رابط الدعوة' /var/www/expertbot/src/components/expert/DashboardHeader.tsx 2>/dev/null");
  console.log("in source:", src.trim());
  
  // Check git log
  const log = await exec("cd /var/www/expertbot && git log --oneline -3");
  console.log("git log:", log.trim());
  
  conn.end();
})
.on("error", e => console.error("error:", e.message))
.connect({ host: "76.13.40.219", port: 22, username: "root", password: "Ali@0164569934", readyTimeout: 15000 });
