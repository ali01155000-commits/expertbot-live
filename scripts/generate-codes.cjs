// يولّد 100 كود تفعيل بصيغة XXXX-XXXX-XXXX-XXXX ويحفظها في ملف txt
const fs = require("fs");

// أحرف واضحة (بدون I, O, 0, 1 الملتبسة)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode() {
  const part = () => Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}

const COUNT = 100;
const codes = new Set();
while (codes.size < COUNT) codes.add(genCode());

const lines = [
  "ExpertBot Live — أكواد التفعيل",
  "================================",
  `عدد الأكواد: ${COUNT}`,
  `تاريخ التوليد: ${new Date().toISOString()}`,
  "================================",
  "",
  ...Array.from(codes),
  "",
  "================================",
  "طريقة الاستخدام:",
  "1. افتح http://76.13.40.219:8080",
  "2. أدخل أحد الأكواد بالأعلى",
  "3. كل كود يُستخدم مرة واحدة فقط",
  "================================",
];

const filename = "expertbot-codes.txt";
fs.writeFileSync(filename, lines.join("\n"), "utf8");
console.log(`✓ تم توليد ${COUNT} كود`);
console.log(`✓ محفوظة في: ${filename}`);
console.log(`\nأول 5 أكواد:`);
Array.from(codes).slice(0, 5).forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
console.log(`\n📊 إجمالي الأكواد في الملف: ${codes.size}`);
