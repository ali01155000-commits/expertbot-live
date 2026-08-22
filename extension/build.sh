#!/usr/bin/env bash
# build.sh — يبني حزمة الإضافة القابلة للتوزيع (extension.zip)
#
# الاستخدام:
#   cd extension
#   ./build.sh
#
# الناتج: extension.zip جاهز للتثبيت على Chrome/Firefox

set -e
cd "$(dirname "$0")"

echo "Building ExpertBot Auto Login extension..."
rm -f expertbot-extension.zip
zip -r expertbot-extension.zip . \
  -x "build.sh" \
  -x "*.DS_Store" \
  -x "expertbot-extension.zip" \
  -x "README.md" 2>/dev/null || true

echo ""
echo "✓ Built: expertbot-extension.zip ($(du -h expertbot-extension.zip | cut -f1))"
echo ""
echo "التثبيت:"
echo "  Chrome:  chrome://extensions ← وضع المطوّر ← تحميل غير مُحزَّم ← اختر مجلد extension/"
echo "  Firefox: about:debugging ← Load Temporary Add-on ← اختر manifest.json"
echo ""
echo "أو شارك expertbot-extension.zip مع المستخدمين ليفكوا الضغط ويثبّتوها."
