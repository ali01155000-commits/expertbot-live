# 🤖 ExpertBot Live

بوت تداول آلي لـ Expert Option — منصة ويب حقيقية + إضافة متصفح للدخول التلقائي.

![status](https://img.shields.io/badge/status-production--ready-brightgreen)
![stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20Bun%20%2B%20socket.io-blue)

## ✨ المميزات

- **دخول تلقائي** عبر إضافة متصفح (لا نسخ/لصق للتوكن)
- **بوت تداول آلي** بإستراتيجيات: Alligator · RSI · تقاطع المتوسطات · اتجاه · مارتينجال
- **رسم شموع يابانية حي** (SVG مخصص)
- **واجهة لموبايل أولاً** مع شريط تبويبات سفلي
- **تداول يدوي** سريع (أزرار Buy/Sell كبيرة)
- **سجل كامل** للصفقات + سجل نشاط ملوّن
- **حساب تجريبي** افتراضي (آمن للتجربة)

## 🏗️ البنية

```
├── src/                          # واجهة Next.js 16 (App Router)
│   ├── app/page.tsx              # الصفحة الرئيسية (لوحة التداول)
│   ├── components/expert/        # مكوّنات الواجهة
│   └── lib/                      # Zustand store + أنواع + API helpers
├── mini-services/expert-service/ # خدمة WebSocket (Bun + socket.io)
│   ├── index.ts                  # خادم socket.io (المنفذ 3003)
│   ├── expert-client.ts          # عميل Expert Option WS (منفذ Python)
│   ├── bot-engine.ts             # محرك البوت + الإستراتيجيات
│   └── indicators.ts             # Alligator · RSI · SMA
├── extension/                    # إضافة متصفح Chrome/Firefox
│   ├── manifest.json             # MV3 manifest
│   ├── content.js                # يلتقط التوكن تلقائياً
│   └── popup.html                # نافذة الإضافة
├── prisma/schema.prisma          # مخطط قاعدة البيانات
├── ecosystem.config.cjs          # إعداد PM2
├── nginx.conf                    # إعداد Nginx
├── Dockerfile                    # نشر Docker
└── setup.sh                      # سكربت إعداد VPS
```

## 🚀 التشغيل محلياً (تطوير)

```bash
bun install
cd mini-services/expert-service && bun install && cd ..
bun run db:push
bun run dev          # الواجهة على :3000
# في تبويب آخر:
cd mini-services/expert-service && bun run dev   # الخدمة على :3003
```

## 📦 النشر على Hostinger VPS

راجع **[DEPLOY.md](./DEPLOY.md)** للدليل الكامل خطوة بخطوة.

الملخص:
1. ارفع الكود إلى GitHub
2. اشترِ Hostinger VPS (Ubuntu 22.04)
3. على الـ VPS: `git clone` + `./setup.sh`
4. فعّل SSL: `certbot --nginx -d your-domain.com`
5. ثبّت إضافة المتصفح

## 🔒 الأمان

- التوكن يُحفظ في `localStorage` فقط (لا يُرفع لأي خادم خارجي)
- إضافة المتصفح تعمل محلياً بالكامل
- افتراضياً: حساب تجريبي (`is_demo: 1`)

## ⚠️ إقرار المسؤولية

هذا التطبيق يتصل بخوادم Expert Option الحقيقية. التداول بأموال فعلية يحمل مخاطر
مالية كبيرة وقد يخالف شروط خدمة Expert Option. أنت تتحمل كامل المسؤولية.

## 📄 الترخيص

MIT — استخدم وحرّر كما تشاء.
