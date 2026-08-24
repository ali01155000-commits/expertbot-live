@echo off
chcp 65001 >nul
title ExpertBot Live — البيئة المتكاملة
color 0A

echo ==================================================
echo   ExpertBot Live — البيئة المتكاملة
echo   متصفح + تسجيل دخول + تداول آلي
echo ==================================================
echo.

:: فحص Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python غير مثبت!
    echo.
    echo حمّل Python من: https://www.python.org/downloads/
    echo IMPORTANT: فعّل "Add Python to PATH" أثناء التثبيت
    echo.
    pause
    exit /b 1
)

echo [1/3] تثبيت المتطلبات...
pip install selenium websocket-client --quiet 2>nul
echo ✅ تم

echo [2/3] تحميل التطبيق...
if not exist "expertbot-all-in-one.py" (
    curl -sL https://raw.githubusercontent.com/ali01155000-commits/expertbot-live/main/telegram-bot/expertbot-all-in-one.py -o expertbot-all-in-one.py
)
echo ✅ تم

echo [3/3] تشغيل...
echo.
echo **********************
echo *  🤖 ExpertBot Live  *
echo *  البيئة المتكاملة   *
echo **********************
echo.
echo 1. اضغط "افتح Expert Option"
echo 2. سجل دخولك في Chrome
echo 3. سيتم التقاط التوكن تلقائياً
echo 4. اضغط "تشغيل البوت"
echo.

python expertbot-all-in-one.py

pause
