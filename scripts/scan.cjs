const net = require("net");

// Test if port 22 is open
const s = new net.Socket();
s.setTimeout(10000);
s.connect(22, "76.13.40.219", () => {
  console.log("✓ المنفذ 22 مفتوح ويقبل الاتصال");
  // Read SSH banner
  s.on("data", (d) => {
    console.log("SSH banner:", d.toString().trim());
    s.destroy();
  });
});
s.on("error", (e) => console.log("✗ خطأ المنفذ 22:", e.message));
s.on("timeout", () => { console.log("✗ انتهت المهلة على المنفذ 22"); s.destroy(); });
