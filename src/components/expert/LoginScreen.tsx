"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ensureExpertSocket,
  useExpertStore,
} from "@/lib/expert-store";
import { REGION_LIST } from "@/lib/expert-types";

const TOKEN_KEY = "expertbot.token";
const REGION_KEY = "expertbot.region";
const DEMO_KEY = "expertbot.isDemo";
const AUTOCONNECT_KEY = "expertbot.autoconnect";

function loadSaved() {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const region = localStorage.getItem(REGION_KEY) || "EUROPE";
    const isDemo = localStorage.getItem(DEMO_KEY) !== "false";
    const autoConnect = localStorage.getItem(AUTOCONNECT_KEY) === "true";
    return { token, region, isDemo, autoConnect };
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  // Lazily create socket singleton on mount so emit/listen works.
  const socket = ensureExpertSocket();

  // Lazy initializers read localStorage once on first render (SSR-safe).
  const [token, setToken] = useState(() => loadSaved()?.token ?? "");
  const [region, setRegion] = useState(() => loadSaved()?.region ?? "EUROPE");
  const [isDemo, setIsDemo] = useState(() => loadSaved()?.isDemo ?? true);
  const [autoConnect, setAutoConnect] = useState(
    () => loadSaved()?.autoConnect ?? false
  );
  const [showToken, setShowToken] = useState(false);

  const connecting = useExpertStore((s) => s.connecting);
  const connectionError = useExpertStore((s) => s.connectionError);

  // Persist token/region/isDemo/autoConnect whenever they change.
  useEffect(() => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(REGION_KEY, region);
      localStorage.setItem(DEMO_KEY, String(isDemo));
      localStorage.setItem(AUTOCONNECT_KEY, String(autoConnect));
    } catch {}
  }, [token, region, isDemo, autoConnect]);

  // Auto-connect on first mount if a saved token + autoConnect flag exist.
  // Skip if the user explicitly disconnected this session (sessionStorage flag).
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("expertbot.skipAuto")) {
      sessionStorage.removeItem("expertbot.skipAuto");
      return;
    }
    const s = loadSaved();
    if (s?.token && s.autoConnect && !connecting) {
      useExpertStore.getState().setConnecting(true);
      useExpertStore.getState().setConnectionError(null);
      useExpertStore.getState().setRegion(s.region);
      socket.emit("expert:connect", {
        token: s.token,
        region: s.region,
        isDemo: s.isDemo,
      });
    }
  }, [socket, connecting]);

  // Reset transient error only when the USER edits the token/region
  const prevInputs = useRef({ token, region });
  useEffect(() => {
    if (
      prevInputs.current.token !== token ||
      prevInputs.current.region !== region
    ) {
      prevInputs.current = { token, region };
      useExpertStore.getState().setConnectionError(null);
    }
  }, [token, region]);

  const handleConnect = () => {
    if (!token.trim()) return;
    useExpertStore.getState().setConnecting(true);
    useExpertStore.getState().setConnectionError(null);
    useExpertStore.getState().setRegion(region);
    socket.emit("expert:connect", {
      token: token.trim(),
      region,
      isDemo,
    });
  };

  const handleClearSaved = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REGION_KEY);
      localStorage.removeItem(DEMO_KEY);
      localStorage.removeItem(AUTOCONNECT_KEY);
    } catch {}
    setToken("");
    setAutoConnect(false);
    setRegion("EUROPE");
    setIsDemo(true);
    useExpertStore.getState().setConnectionError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !connecting) handleConnect();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100">
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 expert-grid-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,14,20,0.85)_70%,_#0a0e14_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-[0_0_40px_-5px_rgba(16,185,129,0.4)]">
              <Bot className="size-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Expert<span className="text-emerald-400">Bot</span> Live
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                بوت تداول Expert Option الآلي — منصة حقيقية
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
            <div className="space-y-5">
              {/* Token */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="token" className="text-zinc-200">
                    <KeyRound className="size-4 text-emerald-400" />
                    رمز الجلسة (Token)
                  </Label>
                  {token && (
                    <button
                      type="button"
                      onClick={handleClearSaved}
                      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300 transition"
                    >
                      <Trash2 className="size-3" />
                      مسح المحفوظ
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="ألصق رمز جلسة Expert Option هنا"
                    className="bg-black/40 font-mono text-sm border-white/10 text-zinc-100 placeholder:text-zinc-600 pr-10 h-11"
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute inset-y-0 left-0 px-3 text-zinc-400 hover:text-zinc-200 transition"
                    aria-label={showToken ? "إخفاء الرمز" : "إظهار الرمز"}
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {token ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    <span>تم حفظ الرمز محلياً على هذا الجهاز</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    طريقة الحصول على الرمز: افتح{" "}
                    <code className="rounded bg-white/5 px-1 py-0.5 text-zinc-300">
                      app.expertoption.com
                    </code>{" "}
                    على المتصفح → DevTools (F12) → Network → WS → انسخ قيمة{" "}
                    <code className="rounded bg-white/5 px-1 py-0.5 text-zinc-300">token</code>.
                  </p>
                )}
              </div>

              {/* Auto-connect toggle */}
              <label
                htmlFor="autoconnect"
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                  autoConnect
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Zap
                    className={`size-4 ${autoConnect ? "text-emerald-400" : "text-zinc-500"}`}
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      اتصال تلقائي عند الفتح
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      حفظ الرمز والاتصال آلياً في الزيارة التالية
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="autoconnect"
                  aria-checked={autoConnect}
                  onClick={() => setAutoConnect((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    autoConnect ? "bg-emerald-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                      autoConnect ? "left-0.5" : "left-[22px]"
                    }`}
                  />
                </button>
              </label>

              {/* Region */}
              <div className="space-y-2">
                <Label className="text-zinc-200">
                  <Zap className="size-4 text-emerald-400" />
                  المنطقة (السيرفر)
                </Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="w-full bg-black/40 border-white/10 text-zinc-100">
                    <SelectValue placeholder="اختر المنطقة" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0e14] border-white/10 text-zinc-100">
                    {REGION_LIST.map((r) => (
                      <SelectItem
                        key={r.key}
                        value={r.key}
                        className="focus:bg-emerald-500/10 focus:text-emerald-300"
                      >
                        <span className="text-base mr-1">{r.flag}</span>
                        <span>{r.labelAr}</span>
                        <span className="text-[10px] text-zinc-500 mr-2" dir="ltr">
                          {r.url.replace("wss://", "").replace("/", "")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account type */}
              <div className="space-y-2">
                <Label className="text-zinc-200">نوع الحساب</Label>
                <RadioGroup
                  value={isDemo ? "demo" : "real"}
                  onValueChange={(v) => setIsDemo(v === "demo")}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="acc-demo"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      isDemo
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/10 bg-black/30 hover:border-white/20"
                    }`}
                  >
                    <RadioGroupItem id="acc-demo" value="demo" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-zinc-100">تجريبي (Demo)</div>
                      <div className="text-[11px] text-zinc-400">أموال وهمية — آمن للتجربة</div>
                    </div>
                  </Label>
                  <Label
                    htmlFor="acc-real"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      !isDemo
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-white/10 bg-black/30 hover:border-white/20"
                    }`}
                  >
                    <RadioGroupItem id="acc-real" value="real" className="mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-zinc-100">حقيقي (Real)</div>
                      <div className="text-[11px] text-zinc-400">أموال فعلية — مخاطرة عالية</div>
                    </div>
                  </Label>
                </RadioGroup>

                {!isDemo && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-200">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                    <div className="leading-relaxed">
                      <strong className="font-semibold">تحذير:</strong> عند اختيار حساب حقيقي،
                      سيتم التداول بأموالك الفعلية على منصة Expert Option. قد تخسر رأس مالك بالكامل.
                      تأكد من فهمك للمخاطر قبل المتابعة.
                    </div>
                  </div>
                )}
              </div>

              {/* Connection error */}
              {connectionError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-200">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="leading-relaxed font-mono">{connectionError}</div>
                </div>
              )}

              {/* Connect button */}
              <Button
                onClick={handleConnect}
                disabled={connecting || !token.trim()}
                className="w-full h-11 bg-emerald-500 text-black hover:bg-emerald-400 font-semibold shadow-[0_0_30px_-5px_rgba(16,185,129,0.6)] disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    جاري الاتصال...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    الاتصال وفتح المنصة
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Risk warning */}
          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="size-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1.5 text-[12px] leading-relaxed text-red-100/90">
                <p className="font-semibold text-red-200">إقرار المسؤولية والمخاطر</p>
                <p>
                  هذا التطبيق يتصل بـ <strong>خوادم Expert Option الحقيقية</strong> باستخدام
                  بروتوكول WebSocket المعكوس. التداول بأموال فعلية يحمل مخاطر مالية كبيرة،
                  وقد يخالف شروط خدمة Expert Option. أنت وحدك تتحمل كامل المسؤولية عن أي
                  خسائر أو عواقب ناتجة عن استخدام هذا البوت.
                </p>
                <p className="text-red-300/70">
                  لا يوجد ضمان للأرباح. السوق عشوائي والبوت قد يخطئ. ابدأ بالحساب التجريبي دائماً.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <Terminal className="size-3" />
            <span>ExpertBot Live — نسخة تجريبية للتطوير</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .expert-grid-bg {
          background-image:
            linear-gradient(rgba(16, 185, 129, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: expert-grid-pan 20s linear infinite;
        }
        @keyframes expert-grid-pan {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 40px 40px, 40px 40px; }
        }
      `}</style>
    </div>
  );
}
