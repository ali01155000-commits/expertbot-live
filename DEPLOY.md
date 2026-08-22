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

## الخطوة 5: تحديث إضافة المتصفح

بعد النشر، حدّث رابط التطبيق في الإضافة:

1. افتح `extension/content.js`
2. غيّر `DEFAULT_APP_URL` إلى نطاقك:
   ```js
   const DEFAULT_APP_URL = "https://your-domain.com/";
   ```
3. غيّر `extension/manifest.json` — أضف نطاقك لـ `host_permissions` و `externally_connectable`:
   ```json
   "host_permissions": [
     "https://app.expertoption.com/*",
     "https://your-domain.com/*"
   ],
   "externally_connectable": {
     "matches": ["https://your-domain.com/*"]
   }
   ```
4. اعمل commit + push:
   ```bash
   git add extension/
   git commit -m "Update extension for production domain"
   git push
   ```
5. على الـ VPS، اسحب التحديث وأعد بناء الـ ZIP:
   ```bash
   cd /var/www/expertbot
   git pull
   cd extension && zip -r ../public/extension.zip . && cd ..
   pm2 restart expertbot-web
   ```

---

## الخطوة 6: التحقق

1. افتح `https://your-domain.com` في المتصفح
2. حمّل الإضافة من زر "تحميل الإضافة"
3. ثبّتها على Chrome: `chrome://extensions` ← وضع المطوّر ← تحميل غير مُحزَّم ← اختر مجلد `extension/`
4. افتح `app.expertoption.com` وسجل دخولك
5. يجب أن يفتح التطبيق تلقائياً جاهزاً للتداول ✓

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
