"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  LogIn,
  Monitor,
  Puzzle,
  ShieldAlert,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

function loadSaved() {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const region = localStorage.getItem(REGION_KEY) || "EUROPE";
    const isDemo = localStorage.getItem(DEMO_KEY) !== "false";
    return { token, region, isDemo };
  } catch {
    return null;
  }
}

function readUrlToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && /^[a-f0-9]{20,}$/i.test(t)) return t;
  } catch {}
  return null;
}

export default function LoginScreen() {
  const socket = ensureExpertSocket();

  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = readUrlToken();
    if (fromUrl) {
      try {
        localStorage.setItem(TOKEN_KEY, fromUrl);
      } catch {}
      return fromUrl;
    }
    return loadSaved()?.token ?? "";
  });
  const [region, setRegion] = useState(() => loadSaved()?.region ?? "EUROPE");
  const [isDemo, setIsDemo] = useState(() => loadSaved()?.isDemo ?? true);
  const [extDetected, setExtDetected] = useState(false);

  const connecting = useExpertStore((s) => s.connecting);
  const connectionError = useExpertStore((s) => s.connectionError);

  // Avoid SSR/client hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const connectWithToken = useCallback(
    (t: string) => {
      if (!t.trim()) return;
      try {
        localStorage.setItem(TOKEN_KEY, t.trim());
      } catch {}
      useExpertStore.getState().setConnecting(true);
      useExpertStore.getState().setConnectionError(null);
      useExpertStore.getState().setRegion(region);
      socket.emit("expert:connect", { token: t.trim(), region, isDemo });
    },
    [region, isDemo, socket]
  );

  // Strip ?token= / ?installed= from the URL after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("token") || params.has("installed")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        url.searchParams.delete("installed");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  }, []);

  // Listen for postMessage from the browser extension (content.js).
  // The extension sends { type: "eo-token", token } when it captures the
  // session on app.expertoption.com.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (
        data &&
        typeof data === "object" &&
        data.type === "eo-token" &&
        data.token &&
        typeof data.token === "string" &&
        /^[a-f0-9]{20,}$/i.test(data.token)
      ) {
        setExtDetected(true);
        setToken(data.token);
        connectWithToken(data.token);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [connectWithToken]);

  // Detect if the extension is installed (it injects a window flag).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      if ((window as any).__expertBotExtension) {
        setExtDetected(true);
      }
    };
    check();
    const iv = setInterval(check, 2000);
    return () => clearInterval(iv);
  }, []);

  // Auto-connect if a saved token exists (and the user didn't explicitly disconnect).
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("expertbot.skipAuto")) {
      sessionStorage.removeItem("expertbot.skipAuto");
      return;
    }
    if (token && !connecting) {
      connectWithToken(token);
    }
  }, [token, connecting, connectWithToken]);

  // Persist region/isDemo.
  useEffect(() => {
    try {
      localStorage.setItem(REGION_KEY, region);
      localStorage.setItem(DEMO_KEY, String(isDemo));
    } catch {}
  }, [region, isDemo]);

  const handleClearSaved = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken("");
    useExpertStore.getState().setConnectionError(null);
  };

  const maskedToken = token
    ? token.slice(0, 6) + "••••••••" + token.slice(-4)
    : "";

  const openExpertOption = () => {
    window.open("https://app.expertoption.com/", "_blank");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100">
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 expert-grid-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,14,20,0.85)_70%,_#0a0e14_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-5">
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
                بوت تداول Expert Option الآلي — دخول تلقائي
              </p>
            </div>
          </div>

          {mounted && (
            <>
              {/* === Saved account quick reconnect === */}
              {token && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-emerald-200">
                          حسابك محفوظ على هذا الجهاز
                        </div>
                        <div className="font-mono text-[11px] text-emerald-400/80" dir="ltr">
                          {maskedToken}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => connectWithToken(token)}
                      disabled={connecting}
                      className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold h-10 gap-1.5"
                    >
                      {connecting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogIn className="size-4" />
                      )}
                      اتصال مباشر
                    </Button>
                  </div>
                  <button
                    onClick={handleClearSaved}
                    className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300 transition"
                  >
                    <Trash2 className="size-3" />
                    نسيان الحساب المحفوظ
                  </button>
                </div>
              )}

              {/* === Primary: install extension for auto-login === */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2">
                  <Puzzle className="size-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-zinc-100">
                    الدخول التلقائي إلى Expert Option
                  </h2>
                </div>

                {/* Extension status */}
                {extDetected ? (
                  <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span className="text-[12px] font-medium text-emerald-200">
                      الإضافة مُثبّتة وفعّالة — ستلتقط جلستك تلقائياً
                    </span>
                  </div>
                ) : (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3">
                    <Puzzle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[12px] leading-relaxed text-amber-200">
                      <strong>ثبّت إضافة المتصفح</strong> مرة واحدة للدخول التلقائي
                      الكامل — بدون نسخ أو لصق أي شيء.
                    </div>
                  </div>
                )}

                {/* Step 1: install extension */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
                      ١
                    </span>
                    <div className="flex-1 space-y-2">
                      <p className="text-[12px] leading-relaxed text-zinc-300">
                        ثبّت إضافة «ExpertBot Auto Login» على متصفحك:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/extension.zip"
                          download
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          <Download className="size-3.5" />
                          تحميل الإضافة
                        </a>
                        <details className="relative">
                          <summary className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 transition list-none">
                            <Monitor className="size-3.5" />
                            طريقة التثبيت
                          </summary>
                          <div className="absolute z-50 mt-2 w-72 rounded-lg border border-white/10 bg-[#0a0e14] p-3 text-[11px] leading-relaxed text-zinc-300 shadow-xl">
                            <p className="mb-1.5 font-semibold text-zinc-100">
                              Chrome / Edge:
                            </p>
                            <ol className="ml-4 list-decimal space-y-0.5">
                              <li>افتح <code className="rounded bg-white/5 px-1">chrome://extensions</code></li>
                              <li>فعّل «وضع المطوّر» أعلى اليمين</li>
                              <li>«تحميل غير مُحزَّم» ← اختر مجلد <code className="rounded bg-white/5 px-1">extension/</code></li>
                            </ol>
                            <p className="mb-1.5 mt-2 font-semibold text-zinc-100">
                              Firefox:
                            </p>
                            <ol className="ml-4 list-decimal space-y-0.5">
                              <li>افتح <code className="rounded bg-white/5 px-1">about:debugging</code></li>
                              <li>«This Firefox» ← «Load Temporary Add-on»</li>
                              <li>اختر <code className="rounded bg-white/5 px-1">manifest.json</code></li>
                            </ol>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: open Expert Option */}
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
                      ٢
                    </span>
                    <div className="flex-1 space-y-2">
                      <p className="text-[12px] leading-relaxed text-zinc-300">
                        افتح Expert Option وسجّل دخولك بحسابك كالمعتاد:
                      </p>
                      <Button
                        onClick={openExpertOption}
                        className="w-full h-12 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
                      >
                        <ExternalLink className="size-4" />
                        فتح Expert Option
                      </Button>
                    </div>
                  </div>

                  {/* Step 3: auto */}
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
                      ٣
                    </span>
                    <div className="flex-1">
                      <p className="text-[12px] leading-relaxed text-zinc-300">
                        <strong className="text-emerald-300">هذا كل شيء!</strong>{" "}
                        بمجرد تسجيل دخولك، ستلتقط الإضافة جلستك تلقائياً ويفتح
                        التطبيق جاهزاً لبدء التداول.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connecting indicator */}
                {connecting && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
                    <Loader2 className="size-4 animate-spin text-emerald-400 shrink-0" />
                    <span className="text-[12px] text-emerald-200">
                      جارٍ الاتصال بـ Expert Option وبدء التداول…
                    </span>
                  </div>
                )}
              </div>

              {/* === Region + account type === */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-200 text-xs">المنطقة (السيرفر)</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="w-full bg-black/40 border-white/10 text-zinc-100 h-10">
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

                <div className="space-y-2">
                  <Label className="text-zinc-200 text-xs">نوع الحساب</Label>
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
                        <div className="text-sm font-medium text-zinc-100">تجريبي</div>
                        <div className="text-[11px] text-zinc-400">آمن للتجربة</div>
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
                        <div className="text-sm font-medium text-zinc-100">حقيقي</div>
                        <div className="text-[11px] text-zinc-400">مخاطرة عالية</div>
                      </div>
                    </Label>
                  </RadioGroup>

                  {!isDemo && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-200">
                      <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                      <div className="leading-relaxed">
                        <strong className="font-semibold">تحذير:</strong> الحساب الحقيقي
                        يداول بأموالك الفعلية. قد تخسر رأس مالك بالكامل.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connection error */}
              {connectionError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-200">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="leading-relaxed font-mono">{connectionError}</div>
                </div>
              )}

              {/* How it works */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="size-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">كيف يعمل الدخول التلقائي</h3>
                </div>
                <ol className="space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
                  <li>
                    <strong className="text-emerald-300">١.</strong> تثبّت الإضافة مرة واحدة على متصفحك.
                  </li>
                  <li>
                    <strong className="text-emerald-300">٢.</strong> تفتح Expert Option وتسجل دخولك كالمعتاد.
                  </li>
                  <li>
                    <strong className="text-emerald-300">٣.</strong> الإضافة تلتقط جلستك تلقائياً في الخلفية.
                  </li>
                  <li>
                    <strong className="text-emerald-300">٤.</strong> يفتح التطبيق جاهزاً — تشغّل البوت فيتداول آلياً.
                  </li>
                </ol>
                <p className="mt-2 text-[10px] text-zinc-500">
                  لا حاجة لنسخ أو لصق أي شيء — كل شيء تلقائي.
                </p>
              </div>

              {/* Risk warning */}
              <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-5 shrink-0 text-red-400 mt-0.5" />
                  <div className="space-y-1.5 text-[12px] leading-relaxed text-red-100/90">
                    <p className="font-semibold text-red-200">إقرار المسؤولية</p>
                    <p>
                      يتصل التطبيق بخوادم Expert Option الحقيقية. التداول بأموال
                      فعلية يحمل مخاطر مالية كبيرة وقد يخالف شروط الخدمة. أنت تتحمل
                      كامل المسؤولية.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span>ExpertBot Live — دخول تلقائي عبر إضافة المتصفح</span>
              </div>
            </>
          )}
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
