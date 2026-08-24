#!/usr/bin/env python3
"""
ExpertBot Live — البيئة المتكاملة
يطبق: فتح متصفح + تسجيل دخول + التقاط توكن + تداول تلقائي

كل شيء في نافذة واحدة:
- يمين: Expert Option (تسجل دخولك)
- يسار: لوحة تحكم البوت (تتحكم في التداول)

الاستخدام:
  pip install selenium websocket-client
  python expertbot-all-in-one.py
"""

import time
import json
import threading
import websocket
import urllib.parse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import tkinter as tk
from tkinter import ttk, scrolledtext
import datetime

# ===== الإعدادات =====
EXPERT_OPTION_URL = "https://app.expertoption.com/"
WS_URL = "wss://fr24g1eu.expertoption.com/"
ASSET_ID = 240  # EUR/USD

# ===== حالة البوت =====
class BotState:
    def __init__(self):
        self.driver = None
        self.token = None
        self.ws = None
        self.ws_connected = False
        self.balance = 0
        self.bot_running = False
        self.bot_thread = None
        self.trades_count = 0
        self.pnl = 0
        self.recent_closes = []
        self.strategy = "trend"
        self.amount = 10
        self.expiry = 30
        self.last_signal_time = 0
        self.ping_thread = None

bot = BotState()

# ===== الواجهة =====
class ExpertBotApp:
    def __init__(self, root):
        self.root = root
        root.title("ExpertBot Live — البيئة المتكاملة")
        root.geometry("1200x700")
        root.configure(bg="#0a0e14")
        
        # الشريط العلوي
        header = tk.Frame(root, bg="#070b11", height=50)
        header.pack(fill="x")
        tk.Label(header, text="🤖 ExpertBot Live", fg="#10b981", bg="#070b11",
                font=("Arial", 16, "bold")).pack(side="left", padx=15, pady=10)
        
        self.status_label = tk.Label(header, text="🔴 غير متصل", fg="#ef4444", bg="#070b11",
                                     font=("Arial", 12))
        self.status_label.pack(side="left", padx=20)
        
        self.balance_label = tk.Label(header, text="💰 الرصيد: —", fg="#fbbf24", bg="#070b11",
                                      font=("Arial", 12))
        self.balance_label.pack(side="left", padx=20)
        
        self.bot_status = tk.Label(header, text="⏸ البوت متوقف", fg="#71717a", bg="#070b11",
                                   font=("Arial", 12))
        self.bot_status.pack(side="right", padx=20)
        
        # المحتوى الرئيسي
        main = tk.Frame(root, bg="#0a0e14")
        main.pack(fill="both", expand=True, padx=10, pady=10)
        
        # يسار: لوحة التحكم
        left = tk.Frame(main, bg="#0d1117", width=350)
        left.pack(side="left", fill="y", padx=(0, 5))
        left.pack_propagate(False)
        
        tk.Label(left, text="لوحة التحكم", fg="#e4e4e7", bg="#0d1117",
                font=("Arial", 14, "bold")).pack(pady=10)
        
        # زر فتح Expert Option
        self.btn_open = tk.Button(left, text="🌐 افتح Expert Option", 
                                  command=self.open_expert_option,
                                  bg="#10b981", fg="black", font=("Arial", 12, "bold"),
                                  height=2, width=30)
        self.btn_open.pack(pady=10, padx=20, fill="x")
        
        # زر التقاط التوكن
        self.btn_grab = tk.Button(left, text="🔍 التقط التوكن",
                                  command=self.grab_token,
                                  bg="#8b5cf6", fg="white", font=("Arial", 12, "bold"),
                                  height=2, width=30, state="disabled")
        self.btn_grab.pack(pady=5, padx=20, fill="x")
        
        # الإستراتيجية
        tk.Label(left, text="الإستراتيجية:", fg="#a1a1aa", bg="#0d1117",
                font=("Arial", 11)).pack(anchor="w", padx=20, pady=(10, 0))
        self.strategy_var = tk.StringVar(value="trend")
        strategies = [("متابعة الاتجاه", "trend"), ("RSI", "rsi"), 
                      ("تقاطع المتوسطات", "ma_cross"), ("Alligator", "alligator")]
        for label, val in strategies:
            tk.Radiobutton(left, text=label, variable=self.strategy_var, value=val,
                          fg="#e4e4e7", bg="#0d1117", selectcolor="#0d1117",
                          font=("Arial", 10)).pack(anchor="w", padx=30)
        
        # قيمة الرهان
        tk.Label(left, text="قيمة الرهان ($):", fg="#a1a1aa", bg="#0d1117",
                font=("Arial", 11)).pack(anchor="w", padx=20, pady=(10, 0))
        self.amount_var = tk.StringVar(value="10")
        tk.Entry(left, textvariable=self.amount_var, font=("Arial", 12),
                bg="#1a1a2e", fg="white", insertbackground="white").pack(padx=20, fill="x")
        
        # مدة الصفقة
        tk.Label(left, text="مدة الصفقة (ثانية):", fg="#a1a1aa", bg="#0d1117",
                font=("Arial", 11)).pack(anchor="w", padx=20, pady=(10, 0))
        self.expiry_var = tk.StringVar(value="30")
        expiries = ["15", "30", "60", "120", "300"]
        ttk.Combobox(left, textvariable=self.expiry_var, values=expiries,
                    font=("Arial", 12), state="readonly").pack(padx=20, fill="x")
        
        # أزرار التشغيل
        self.btn_start = tk.Button(left, text="▶ تشغيل البوت",
                                   command=self.start_bot,
                                   bg="#10b981", fg="black", font=("Arial", 14, "bold"),
                                   height=2, state="disabled")
        self.btn_start.pack(pady=15, padx=20, fill="x")
        
        self.btn_stop = tk.Button(left, text="■ إيقاف البوت",
                                  command=self.stop_bot,
                                  bg="#ef4444", fg="white", font=("Arial", 14, "bold"),
                                  height=2, state="disabled")
        self.btn_stop.pack(pady=5, padx=20, fill="x")
        
        # تداول يدوي
        tk.Label(left, text="تداول يدوي:", fg="#a1a1aa", bg="#0d1117",
                font=("Arial", 11)).pack(pady=(15, 5))
        
        btn_frame = tk.Frame(left, bg="#0d1117")
        btn_frame.pack(padx=20, fill="x")
        tk.Button(btn_frame, text="▲ شراء", command=lambda: self.manual_trade("call"),
                 bg="#10b981", fg="black", font=("Arial", 12, "bold"), height=2).pack(side="left", expand=True, fill="x", padx=2)
        tk.Button(btn_frame, text="▼ بيع", command=lambda: self.manual_trade("put"),
                 bg="#ef4444", fg="white", font=("Arial", 12, "bold"), height=2).pack(side="right", expand=True, fill="x", padx=2)
        
        # إحصائيات
        self.stats_label = tk.Label(left, text="📊 صفقات: 0 | ربح: 0.00$", fg="#a1a1aa", bg="#0d1117",
                                    font=("Arial", 11))
        self.stats_label.pack(pady=10)
        
        # يمين: السجل
        right = tk.Frame(main, bg="#0d1117")
        right.pack(side="right", fill="both", expand=True)
        
        tk.Label(right, text="سجل النشاط", fg="#e4e4e7", bg="#0d1117",
                font=("Arial", 14, "bold")).pack(pady=10)
        
        self.log_text = scrolledtext.ScrolledText(right, bg="#000000", fg="#10b981",
                                                  font=("Consolas", 11), height=25)
        self.log_text.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        
        self.log("مرحباً بك في ExpertBot Live!")
        self.log("اضغط 'افتح Expert Option' للبدء")
    
    def log(self, msg):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{timestamp}] {msg}\n")
        self.log_text.see("end")
    
    def open_expert_option(self):
        """يفتح Chrome مع Expert Option"""
        self.log("🌐 جارٍ فتح Expert Option...")
        self.status_label.config(text="🟡 جارٍ الفتح...", fg="#fbbf24")
        
        def open_thread():
            try:
                options = Options()
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--window-size=1024,768")
                options.add_argument("--window-position=0,0")
                
                bot.driver = webdriver.Chrome(options=options)
                bot.driver.get(EXPERT_OPTION_URL)
                
                self.root.after(0, lambda: [
                    self.status_label.config(text="🟢 Expert Option مفتوح", fg="#10b981"),
                    self.btn_grab.config(state="normal"),
                    self.log("✅ Expert Option مفتوح! سجل دخولك الآن"),
                    self.log("⏳ بعد تسجيل الدخول، اضغط 'التقط التوكن'"),
                ])
                
                # راقب التوكن تلقائياً
                self.auto_watch_token()
                
            except Exception as e:
                self.root.after(0, lambda: [
                    self.log(f"❌ خطأ: {e}"),
                    self.status_label.config(text="🔴 خطأ", fg="#ef4444"),
                ])
        
        threading.Thread(target=open_thread, daemon=True).start()
    
    def auto_watch_token(self):
        """يراقب التوكن تلقائياً كل 3 ثوان"""
        def watch():
            while bot.driver and not bot.token:
                time.sleep(3)
                try:
                    token = bot.driver.execute_script("""
                        try {
                            var auth = localStorage.getItem('auth');
                            if (auth) {
                                var parsed = JSON.parse(auth);
                                if (parsed.token) return parsed.token;
                            }
                        } catch(e) {}
                        try {
                            for (var i = 0; i < localStorage.length; i++) {
                                var v = localStorage.getItem(localStorage.key(i));
                                if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) return v;
                            }
                        } catch(e) {}
                        return null;
                    """)
                    if token:
                        bot.token = token
                        self.root.after(0, lambda: self.on_token_found(token))
                        return
                except:
                    pass
        
        threading.Thread(target=watch, daemon=True).start()
    
    def grab_token(self):
        """يلتقط التوكن يدوياً"""
        if not bot.driver:
            self.log("❌ افتح Expert Option أولاً")
            return
        
        self.log("🔍 جارٍ البحث عن التوكن...")
        try:
            token = bot.driver.execute_script("""
                try {
                    var auth = localStorage.getItem('auth');
                    if (auth) {
                        var parsed = JSON.parse(auth);
                        if (parsed.token) return parsed.token;
                    }
                } catch(e) {}
                try {
                    for (var i = 0; i < localStorage.length; i++) {
                        var v = localStorage.getItem(localStorage.key(i));
                        if (v && v.length >= 20 && v.length <= 80 && /^[a-f0-9]+$/i.test(v)) return v;
                    }
                } catch(e) {}
                return null;
            """)
            if token:
                self.on_token_found(token)
            else:
                self.log("❌ لم يتم العثور على التوكن. سجل دخولك أولاً")
        except Exception as e:
            self.log(f"❌ خطأ: {e}")
    
    def on_token_found(self, token):
        """عند العثور على التوكن"""
        bot.token = token
        self.log(f"✅ تم التقاط التوكن! {token[:8]}...{token[-4:]}")
        self.status_label.config(text="🟢 التوكن جاهز", fg="#10b981")
        self.btn_start.config(state="normal")
        self.connect_websocket()
    
    def connect_websocket(self):
        """يتصل بـ Expert Option عبر WebSocket"""
        self.log("🔌 جارٍ الاتصال بـ Expert Option...")
        
        def on_ws_open(ws):
            self.root.after(0, lambda: self.log("🔌 متصل بـ Expert Option!"))
            # إرسال التهيئة
            init_msg = {
                "action": "multipleAction",
                "message": {
                    "token": bot.token,
                    "actions": [
                        {"action": "profile", "message": None, "ns": 2, "v": 18, "token": bot.token},
                        {"action": "defaultSubscribeCandles", "message": {"modes": ["vanilla"], "timeframes": [0, 5]}, "ns": 7, "v": 18, "token": bot.token},
                    ]
                },
                "token": bot.token,
                "ns": 2
            }
            send_ws(ws, init_msg)
            send_ws(ws, {"action": "setContext", "message": {"is_demo": 1}, "token": bot.token, "ns": 1})
            
            # ping
            def ping():
                while bot.ws_connected:
                    time.sleep(5)
                    try:
                        send_ws(ws, {"action": "ping", "v": 23, "message": {}})
                    except:
                        pass
            threading.Thread(target=ping, daemon=True).start()
        
        def on_ws_message(ws, data):
            try:
                msg = json.loads(data)
                action = msg.get("action", "")
                
                if action == "multipleAction" and msg.get("message", {}).get("actions"):
                    for sub in msg["message"]["actions"]:
                        handle_ws_message(sub)
                    return
                
                handle_ws_message(msg)
            except:
                pass
        
        def on_ws_error(ws, error):
            self.root.after(0, lambda: self.log(f"❌ خطأ WS: {error}"))
        
        def on_ws_close(ws):
            bot.ws_connected = False
            self.root.after(0, lambda: [
                self.status_label.config(text="🔴 انقطع الاتصال", fg="#ef4444"),
                self.log("⚠️ انقطع الاتصال بـ Expert Option"),
            ])
        
        def handle_ws_message(msg):
            action = msg.get("action", "")
            
            if action == "profile":
                bot.balance = msg.get("message", {}).get("balance", 0)
                bot.ws_connected = True
                self.root.after(0, lambda: [
                    self.status_label.config(text="🟢 متصل", fg="#10b981"),
                    self.balance_label.config(text=f"💰 الرصيد: {bot.balance:.2f}$"),
                    self.log(f"✅ متصل! الرصيد: {bot.balance}$"),
                ])
            
            elif action in ("candles", "subscribeCandles"):
                try:
                    candles = msg.get("message", {}).get("candles", [])
                    for c in candles:
                        periods = c.get("periods", [])
                        for p in periods:
                            arr = p[1] if len(p) > 1 else []
                            if arr and len(arr) > 0:
                                last = arr[-1]
                                if last and len(last) >= 4:
                                    bot.recent_closes.append(last[3])
                                    if len(bot.recent_closes) > 50:
                                        bot.recent_closes.pop(0)
                except:
                    pass
            
            elif action == "buyOption":
                bot.trades_count += 1
                self.root.after(0, lambda: self.update_stats())
            
            elif action == "error":
                err = msg.get("message", {})
                self.root.after(0, lambda: self.log(f"⚠️ خطأ: {json.dumps(err)[:100]}"))
        
        def send_ws(ws, msg):
            data = json.dumps(msg)
            encoded = urllib.parse.quote(data)
            ws.send(encoded, opcode=0x2)  # binary
        
        bot.ws = websocket.WebSocketApp(WS_URL,
                                        on_open=on_ws_open,
                                        on_message=on_ws_message,
                                        on_error=on_ws_error,
                                        on_close=on_ws_close,
                                        header={"Origin": "https://app.expertoption.com"})
        
        def run_ws():
            bot.ws.run_forever(sslopt={"cert_reqs": 0})
        
        threading.Thread(target=run_ws, daemon=True).start()
    
    def start_bot(self):
        """يشغل البوت"""
        if not bot.token or not bot.ws_connected:
            self.log("❌ غير متصل بـ Expert Option")
            return
        
        bot.bot_running = True
        bot.strategy = self.strategy_var.get()
        bot.amount = int(self.amount_var.get())
        bot.expiry = int(self.expiry_var.get())
        bot.trades_count = 0
        bot.pnl = 0
        
        self.btn_start.config(state="disabled")
        self.btn_stop.config(state="normal")
        self.bot_status.config(text="🟢 البوت يعمل", fg="#10b981")
        self.log(f"▶ تشغيل البوت — {bot.strategy} | {bot.amount}$ | {bot.expiry}ث")
        
        bot.bot_thread = threading.Thread(target=self.bot_loop, daemon=True)
        bot.bot_thread.start()
    
    def bot_loop(self):
        """حلقة البوت"""
        while bot.bot_running:
            time.sleep(5)
            if not bot.bot_running or not bot.ws_connected:
                continue
            
            candles = bot.recent_closes
            if len(candles) < 8:
                continue
            
            direction = self.evaluate(bot.strategy, candles)
            if not direction:
                continue
            
            now = time.time()
            if now - bot.last_signal_time < 15:
                continue
            bot.last_signal_time = now
            
            self.execute_trade(direction)
    
    def evaluate(self, strategy, candles):
        """يقيّم الإستراتيجية"""
        if strategy == "ma_cross":
            fast = self.sma(candles, 3)
            slow = self.sma(candles, 8)
            prev_fast = self.sma(candles[:-1], 3)
            prev_slow = self.sma(candles[:-1], 8)
            if None in (fast, slow, prev_fast, prev_slow):
                return None
            if prev_fast <= prev_slow and fast > slow:
                return "call"
            if prev_fast >= prev_slow and fast < slow:
                return "put"
        
        elif strategy == "rsi":
            r = self.rsi(candles, 7)
            if r is None:
                return None
            if r < 30:
                return "call"
            if r > 70:
                return "put"
        
        elif strategy == "trend":
            last5 = candles[-5:]
            ups = sum(1 for i in range(1, len(last5)) if last5[i] > last5[i-1])
            if ups >= 4:
                return "call"
            if ups <= 1:
                return "put"
        
        elif strategy == "alligator":
            jaw = self.sma(candles, 13)
            teeth = self.sma(candles, 8)
            lips = self.sma(candles, 5)
            if None in (jaw, teeth, lips):
                return None
            if lips > teeth and teeth > jaw:
                return "call"
            if lips < teeth and teeth < jaw:
                return "put"
        
        return None
    
    def sma(self, values, period):
        if len(values) < period:
            return None
        return sum(values[-period:]) / period
    
    def rsi(self, values, period=14):
        if len(values) < period + 1:
            return None
        gains = 0
        losses = 0
        for i in range(len(values) - period, len(values)):
            diff = values[i] - values[i-1]
            if diff >= 0:
                gains += diff
            else:
                losses -= diff
        if losses == 0:
            return 100
        rs = (gains / period) / (losses / period)
        return 100 - 100 / (1 + rs)
    
    def execute_trade(self, direction):
        """ينفّذ صفقة"""
        if not bot.ws or not bot.ws_connected:
            return
        
        strike_time = int(time.time())
        exp_time = strike_time + bot.expiry
        
        trade_msg = {
            "action": "buyOption",
            "message": {
                "type": direction,
                "amount": bot.amount,
                "assetid": ASSET_ID,
                "strike_time": strike_time,
                "expiration_time": exp_time,
                "is_demo": 1,
                "rateIndex": 1
            },
            "token": bot.token,
            "ns": 44
        }
        
        data = json.dumps(trade_msg)
        encoded = urllib.parse.quote(data)
        bot.ws.send(encoded, opcode=0x2)
        
        emoji = "▲" if direction == "call" else "▼"
        label = "شراء" if direction == "call" else "بيع"
        self.root.after(0, lambda: self.log(f"🎯 {bot.strategy}: {emoji} {label} | {bot.amount}$ | {bot.expiry}ث"))
    
    def manual_trade(self, direction):
        """تداول يدوي"""
        if not bot.ws_connected:
            self.log("❌ غير متصل")
            return
        bot.amount = int(self.amount_var.get())
        bot.expiry = int(self.expiry_var.get())
        self.execute_trade(direction)
    
    def stop_bot(self):
        """يوقف البوت"""
        bot.bot_running = False
        self.btn_start.config(state="normal")
        self.btn_stop.config(state="disabled")
        self.bot_status.config(text="⏸ البوت متوقف", fg="#71717a")
        self.log(f"■ تم إيقاف البوت — صفقات: {bot.trades_count}")
    
    def update_stats(self):
        """يحدّث الإحصائيات"""
        self.stats_label.config(text=f"📊 صفقات: {bot.trades_count} | ربح: {bot.pnl:.2f}$")
    
    def on_closing(self):
        """عند الإغلاق"""
        bot.bot_running = False
        if bot.ws:
            bot.ws.close()
        if bot.driver:
            try:
                bot.driver.quit()
            except:
                pass
        self.root.destroy()

# ===== التشغيل =====
if __name__ == "__main__":
    root = tk.Tk()
    app = ExpertBotApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
