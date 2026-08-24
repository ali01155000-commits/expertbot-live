#!/usr/bin/env python3
"""
ExpertBot — ملتقط التوكن التلقائي
يفتح Expert Option في متصفح Chrome، المستخدم يسجل دخوله،
ثم يلتقط التوكن تلقائياً ويرسله لبوت تيليجرام.

الاستخدام:
  python3 token-grabber.py

المتطلبات:
  pip install selenium requests
  Chrome مثبت على الجهاز
"""

import time
import sys
import requests

# ===== الإعدادات =====
TELEGRAM_BOT_TOKEN = "8943921942:AAFabWQ7_cQt0ZfctM2sFAA6FQm7RqT-u4k"
BOT_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
EXPERT_OPTION_URL = "https://app.expertoption.com/"
WAIT_TIME = 120  # ثانيتان دقيقة للمستخدم لتسجيل الدخول

def get_chat_id():
    """احصل على chat_id من آخر رسالة في البوت"""
    try:
        r = requests.get(f"{BOT_API_URL}/getUpdates?limit=1&offset=-1", timeout=10)
        data = r.json()
        if data.get("result"):
            return data["result"][0]["message"]["chat"]["id"]
    except:
        pass
    return None

def send_telegram(chat_id, text):
    """أرسل رسالة لتيليجرام"""
    try:
        requests.post(f"{BOT_API_URL}/sendMessage", json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }, timeout=10)
    except:
        pass

def main():
    print("=" * 50)
    print("  ExpertBot — ملتقط التوكن التلقائي")
    print("=" * 50)
    print()

    # احصل على chat_id
    chat_id = get_chat_id()
    if chat_id:
        send_telegram(chat_id, "🔄 جارٍ فتح Expert Option...\n\nسجل دخولك في المتصفح الذي سيفتح.")
        print(f"✅ تم الاتصال ببوت تيليجرام (chat_id: {chat_id})")
    else:
        print("⚠️ لم يتم العثور على chat_id. أرسل /start للبوت في تيليجرام أولاً.")

    # استيراد selenium
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.chrome.options import Options
    except ImportError:
        print("❌ selenium غير مثبت. ثبته: pip install selenium")
        sys.exit(1)

    # إعداد Chrome
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    
    print("\n🌐 جارٍ فتح Expert Option...")
    
    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"❌ تعذّر فتح Chrome: {e}")
        print("تأكد من تثبيت Chrome: apt install chromium-browser")
        sys.exit(1)

    driver.get(EXPERT_OPTION_URL)
    
    print(f"\n⏳ يرجى تسجيل الدخول في المتصفح...")
    print(f"⏳ لديك {WAIT_TIME} ثانية لتسجيل الدخول")
    print(f"⏳ سيتم التقاط التوكن تلقائياً بعد تسجيل الدخول\n")

    # انتظر وابحث عن التوكن
    token = None
    for i in range(WAIT_TIME):
        time.sleep(1)
        
        # ابحث عن التوكن كل 3 ثوان
        if i % 3 == 0:
            try:
                # ابحث في localStorage
                token = driver.execute_script("""
                    try {
                        var auth = localStorage.getItem('auth');
                        if (auth) {
                            var parsed = JSON.parse(auth);
                            if (parsed.token) return parsed.token;
                        }
                    } catch(e) {}
                    
                    // ابحث في كل القيم
                    try {
                        for (var i = 0; i < localStorage.length; i++) {
                            var v = localStorage.getItem(localStorage.key(i));
                            if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) {
                                return v;
                            }
                        }
                    } catch(e) {}
                    
                    return null;
                """)
                
                if token:
                    break
            except:
                pass
        
        # اعرض العد التنازلي
        remaining = WAIT_TIME - i
        if remaining % 10 == 0:
            print(f"⏳ {remaining} ثانية متبقية...")
    
    if token:
        print(f"\n✅ تم استخراج التوكن بنجاح!")
        print(f"📌 {token[:8]}...{token[-4:]}")
        
        # احفظ في ملف
        with open("token.txt", "w") as f:
            f.write(token)
        print(f"💾 تم حفظ التوكن في token.txt")
        
        # أرسل للبوت تيليجرام
        if chat_id:
            send_telegram(chat_id, 
                f"✅ *تم التقاط التوكن تلقائياً!*\n\n"
                f"التوكن: `{token[:8]}...{token[-4:]}`\n\n"
                f"استخدم /run لتشغيل البوت"
            )
            print(f"📤 تم إرسال التوكن لبوت تيليجرام!")
        else:
            # اعرض التوكن كاملاً
            print(f"\n📋 التوكن الكامل:")
            print(token)
            print(f"\n💡 انسخه وأرسله للبوت: /token {token}")
    else:
        print(f"\n❌ لم يتم العثور على التوكن.")
        print(f"تأكد من تسجيل الدخول بنجاح في Expert Option.")
    
    driver.quit()
    print(f"\n👋 تم إغلاق المتصفح. مع السلامة!")

if __name__ == "__main__":
    main()
