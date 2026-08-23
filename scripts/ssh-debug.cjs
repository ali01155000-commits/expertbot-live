const { Client } = require("ssh2");

const conn = new Client();
conn.on("ready", () => { console.log("✓ متصل"); conn.end(); })
   .on("error", (e) => console.log("✗ خطأ:", e.message))
   .on("handshake", () => console.log("✓ handshake OK"))
   .on("keyboard-interactive", (name, instr, lang, prompts, finish) => {
     console.log("keyboard-interactive name:", name);
     console.log("instructions:", instr);
     console.log("prompts:", prompts.map(p => p.prompt));
     finish(["Ali@0164569934"]);
   })
   .on("debug", (msg) => console.log("debug:", msg))
   .connect({
     host: "76.13.40.219",
     port: 22,
     username: "root",
     password: "Ali@0164569934",
     tryKeyboard: true,
     readyTimeout: 20000,
     debug: console.log,
   });
