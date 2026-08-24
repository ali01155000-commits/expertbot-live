@echo off
chcp 65001 >nul
title ExpertBot — ملتقط التوكن التلقائي
color 0A

echo ==================================================
echo   ExpertBot — ملتقط التوكن التلقائي
echo   يفتح Expert Option + يلتقط التوكن + يرسله للبوت
echo ==================================================
echo.

:: فحص Python
echo [1/4] فحص Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python غير مثبت!
    echo.
    echo حمّل Python من: https://www.python.org/downloads/
    echo أثناء التثبيت، فعّل "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
echo ✅ Python مثبت

:: تثبيت Selenium
echo.
echo [2/4] تثبيت Selenium...
pip install selenium requests --quiet 2>nul
if %errorlevel% neq 0 (
    echo ⏳ جارٍ إعادة المحاولة...
    pip install selenium requests
)
echo ✅ Selenium مثبت

:: تحميل السكربت
echo.
echo [3/4] تحميل السكربت...
if not exist "token-grabber.py" (
    curl -sL https://raw.githubusercontent.com/ali01155000-commits/expertbot-live/main/telegram-bot/token-grabber.py -o token-grabber.py
)
echo ✅ السكربت جاهز

:: تشغيل
echo.
echo [4/4] تشغيل...
echo.
echo 🌐 سيفتح Chrome تلقائياً
echo 📝 سجل دخولك في Expert Option
echo ⏳ سيتم التقاط التوكن تلقائياً
echo.
echo اضغط أي زر للبدء...
pause >nul

python token-grabber.py

echo.
echo اضغط أي زر للخروج...
pause >nul
