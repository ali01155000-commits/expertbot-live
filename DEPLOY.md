# 🚀 دليل النشر على Hostinger VPS

دليل كامل خطوة بخطوة لنشر ExpertBot Live على Hostinger VPS من GitHub.

---

## 📋 المتطلبات

1. **حساب Hostinger VPS** (وليس الاستضافة المشتركة — هذه لا تدعم Node.js/Bun)
   - الخطة الأرخص تكفي (KVM 1: 1 vCPU, 4GB RAM)
2. **اسم نطاق (domain)** يشير إلى IP الـ VPS
3. **حساب GitHub**

---

## الخطوة 1: رفع الكود إلى GitHub

```bash
# على جهازك المحلي (في مجلد المشروع):
git init
git add .
git commit -m "Initial commit — ExpertBot Live"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expertbot-live.git
git push -u origin main
```

---

## الخطوة 2: إعداد Hostinger VPS

### 2.1 شراء VPS وتسجيل الدخول
1. اذهب إلى [hostinger.com/vps-hosting](https://www.hostinger.com/vps-hosting)
2. اشترِ خطة KVM (الخطة 1 تكفي)
3. اختر **Ubuntu 22.04** كنظام تشغيل
4. بعد الإنشاء، ستجد IP الـ VPS وكلمة المرور في لوحة تحكم Hostinger

### 2.2 الاتصال بالـ VPS
```bash
ssh root@YOUR_VPS_IP
# أدخل كلمة المرور من لوحة Hostinger
```

### 2.3 توجيه النطاق (DNS)
في لوحة تحكم النطاق (Namecheap/GoDaddy/Hostinger):
- أضف **A record**: `@` → `YOUR_VPS_IP`
- أضف **A record**: `www` → `YOUR_VPS_IP`
- انتظر 5-30 دقيقة لانتشار DNS

---

## الخطوة 3: تثبيت التطبيق

### 3.1 استنساخ المستودع
```bash
ssh root@YOUR_VPS_IP
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_USERNAME/expertbot-live.git expertbot
cd expertbot
```

### 3.2 تعديل الإعدادات
```bash
cp .env.example .env
nano .env
```
غيّر القيم:
```
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_EXPERT_SERVICE_URL=https://your-domain.com
```

### 3.3 تعديل Nginx config
```bash
nano nginx.conf
# استبدل every "your-domain.com" بنطاقك الفعلي
```

### 3.4 تشغيل سكربت الإعداد
```bash
chmod +x setup.sh
./setup.sh
```
هذا السكربت يثبّت: Node.js + Bun + PM2 + Nginx، يبني التطبيق، ويشغّل الخدمات.

---

## الخطوة 4: تفعيل SSL (HTTPS)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com -d www.your-domain.com
# اتبع التعليمات (بريد إلكتروني، موافقة على الشروط)
```

---

## الخطوة 5: إضافة المتصفح (مستقلة عن البوت)

### 📌 معلومة مهمة
**الإضافة لا تحتاج رفعها مع البوت على السيرفر.** الإضافة تعيش في متصفح المستخدم
(Chrome/Firefox)، ليست جزءاً من السيرفر. لكن تحتاج:

1. توزيع ملف `extension.zip` على المستخدمين (من أي مكان)
2. تحديث نطاق البوت داخل الإضافة (من نافذة الإضافة نفسها — لا تعديل كود)

### الخيار A: الإضافة تُحمّل من البوت (الأسهل — الافتراضي)
لا تفعل شيئاً. البوت يخدم `extension.zip` من `/public/`. المستخدمون يحمّلونها من زر «تحميل الإضافة» في التطبيق.

### الخيار B: الإضافة على GitHub Releases (مستقلة)
1. اذهب لمستودع GitHub ← Releases ← «Create a new release»
2. ارفع `extension.zip` كأصل (asset)
3. انسخ رابط التحميل المباشر
4. في `.env` على السيرفر:
   ```bash
   NEXT_PUBLIC_EXTENSION_URL=https://github.com/USERNAME/REPO/releases/download/v1.0/expertbot-extension.zip
   ```
5. أعد تشغيل البوت: `pm2 restart expertbot-web`

### تحديث نطاق البوت داخل الإضافة (بدون تعديل كود)
الإضافة مصممة ليُعدّل رابط البوت من نافذتها:
1. اضغط أيقونة الإضافة في شريط المتصفح
2. في حقل **«رابط التطبيق»**، أدخل: `https://your-domain.com/`
3. يُحفظ تلقائياً ✓

لا حاجة لتعديل `content.js` أو `manifest.json` — الرابط يُخزّن في `chrome.storage`.

### (اختياري) تحديث `manifest.json` للنطاقات المسموحة
إذا أردت استخدام `externally_connectable` (للكشف التلقائي لتثبيت الإضافة):
```json
"host_permissions": [
  "https://app.expertoption.com/*",
  "https://your-domain.com/*"
],
"externally_connectable": {
  "matches": ["https://your-domain.com/*"]
}
```
ثم أعد بناء `extension.zip`:
```bash
cd extension
./build.sh
# أو يدوياً: zip -r expertbot-extension.zip . -x "build.sh" "README.md"
```

---

## الخطوة 6: التحقق

1. افتح `https://your-domain.com` في المتصفح
2. حمّل الإضافة من زر "تحميل الإضافة"
3. ثبّتها على Chrome: `chrome://extensions` ← وضع المطوّر ← تحميل غير مُحزَّم ← اختر مجلد `extension/`
4. افتح `app.expertoption.com` وسجل دخولك
5. يجب أن يفتح التطبيق تلقائياً جاهزاً للتداول ✓

---

## الخطوة 6: تثبيت التطبيق على الآيفون (PWA)

التطبيق يعمل كـ **PWA** — يظهر كتطبيق أصلي على شاشتك الرئيسية:

### 6.1 على الكمبيوتر: احصل على التوكن
1. ثبّت إضافة المتصفح (كما في الخطوة 5)
2. افتح Expert Option وسجل دخولك → التطبيق يفتح تلقائياً
3. في بطاقة "حسابك محفوظ" اضغط **"نقل للآيفون (QR)"**
4. يظهر QR code على الشاشة

### 6.2 على الآيفون: امسح الـ QR وثبّت التطبيق
1. افتح **الكاميرا** على الآيفون
2. وجّهها نحو الـ QR code على شاشة الكمبيوتر
3. اضغط على الإشعار الذي يظهر ← يفتح التطبيق في Safari
4. التطبيق يتصل تلقائياً بالتوكن ✓
5. في Safari: اضغط زر **المشاركة** (□↑) أسفل الشاشة
6. اختر **"Add to Home Screen"** ← "إضافة"
7. ✅ الآن لديك أيقونة **ExpertBot** على شاشتك الرئيسية — تعمل كتطبيق أصلي بملء الشاشة

### ملاحظات iOS
- **الإضافة لا تعمل على آيفون** (iOS لا يدعم إضافات المتصفح) — لذلك نستخدم QR code لنقل الجلسة
- التطبيق يعمل **بدون Safari chrome** (شريط العنوان مخفي) بعد الإضافة للشاشة الرئيسية
- يعمل **دون اتصال** (service worker يخزّن الواجهة محلياً)
- التوكن محفوظ على الآيفون — لا حاجة لمسح QR كل مرة

---

## 🔧 أوامر الإدارة

| المهمة | الأمر |
|---|---|
| حالة الخدمات | `pm2 status` |
| سجلات حية | `pm2 logs` |
| إعادة التشغيل | `pm2 restart all` |
| إيقاف | `pm2 stop all` |
| تحديث الكود | `git pull && bun run build && pm2 restart all` |
| سجلات Nginx | `tail -f /var/log/nginx/access.log` |
| حالة Nginx | `systemctl status nginx` |

---

## 🆘 استكشاف الأخطاء

### التطبيق لا يفتح
```bash
pm2 logs expertbot-web    # أخطاء الواجهة
pm2 logs expertbot-service # أخطاء الخدمة
nginx -t                  # أخطاء Nginx
```

### WebSocket لا يتصل
- تأكد أن Nginx يحوّل `/socket.io/` للمنفذ 3003
- تحقق: `curl -I https://your-domain.com/socket.io/?EIO=4&transport=polling`

### الإضافة لا تعمل
- تأكد أن نطاقك مضاف لـ `host_permissions` في manifest.json
- أعد تحميل الإضافة في `chrome://extensions`

---

## ⚠️ ملاحظات مهمة

1. **النسخ الاحتياطي**: قاعدة بيانات SQLite في `db/expertbot.db` — انسخها دورياً:
   ```bash
   cp db/expertbot.db db/expertbot-backup-$(date +%F).db
   ```

2. **الأمان**: لا ترفع ملف `.env` إلى GitHub (مُتجاهل في .gitignore)

3. **التحديثات**: لتحديث التطبيق بعد تعديل الكود:
   ```bash
   cd /var/www/expertbot
   git pull
   bun install
   bun run build
   pm2 restart all
   ```

4. **التكلفة**: خطة Hostinger VPS تبدأ من ~$4-7/شهر

5. **المواصفات**: الخطة 1 (1 vCPU, 4GB RAM) تكفي لتطبيق واحد
