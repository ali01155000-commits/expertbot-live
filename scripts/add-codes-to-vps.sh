#!/usr/bin/env bash
# أضف 100 كود لقاعدة بيانات الـ VPS دفعة واحدة
# الاستخدام: انسخ هذا الملف للـ VPS ثم شغّله

set -e
cd /var/www/expertbot

echo "=== إضافة 100 كود لقاعدة البيانات ==="

# اقرأ كل كود من الملف وأضفه
COUNT=0
while IFS= read -r code; do
  # تخطّي الأسطر غير الكود (فارغة، عناوين، ===)
  case "$code" in
    ""|*"=="*|*"ExpertBot"*|*"عدد"*|*"تاريخ"*|*"طريقة"*|*"1."*|*"2."*|*"3."*) continue ;;
  esac
  
  # أضف الكود لقاعدة البيانات باستخدام sqlite3
  ID=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 24)
  sqlite3 db/expertbot.db "INSERT INTO ActivationCode (id, code, status, createdAt) VALUES ('$ID', '$code', 'active', datetime('now'));" 2>/dev/null && COUNT=$((COUNT+1)) || echo "تخطّي (مكرر): $code"
done < expertbot-codes.txt

echo ""
echo "✅ تم إضافة $COUNT كود لقاعدة البيانات"
echo "📊 إجمالي الأكواد في قاعدة البيانات:"
sqlite3 db/expertbot.db "SELECT status, COUNT(*) FROM ActivationCode GROUP BY status;" 2>/dev/null
