"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  LogIn,
  ShieldAlert,
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

// Console command the user pastes into app.expertoption.com's DevTools Console.
// It copies the Expert Option token to the clipboard.
const CONSOLE_CMD =
  "copy(JSON.parse(localStorage.getItem('auth')||'{}').token||Object.values(localStorage).find(v=>/^[a-f0-9]{24,}$/i.test(v)))";

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

/**
 * Extract ?token= from the URL (set by the console-command flow or a shared
 * link). Does NOT modify the URL — cleanup is done in a useEffect after mount.
 */
function readUrlToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && /^[a-f0-9]{20,}$/i.test(t)) {
      return t;
    }
  } catch {}
  return null;
}

export default function LoginScreen() {
  const socket = ensureExpertSocket();

  // Read ?token= from URL ONCE (lazy). If present, overrides saved token.
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = readUrlToken();
    if (fromUrl) {
      try {
        localStorage.setItem(TOKEN_KEY, fromUrl);
        localStorage.setItem(AUTOCONNECT_KEY, "true");
      } catch {}
      return fromUrl;
    }
    return loadSaved()?.token ?? "";
  });
  const [region, setRegion] = useState(() => loadSaved()?.region ?? "EUROPE");
  const [isDemo, setIsDemo] = useState(() => loadSaved()?.isDemo ?? true);
  const [autoConnect, setAutoConnect] = useState(
    () => loadSaved()?.autoConnect ?? false
  );
  const [manualToken, setManualToken] = useState("");
  const [copied, setCopied] = useState(false);

  const connecting = useExpertStore((s) => s.connecting);
  const connectionError = useExpertStore((s) => s.connectionError);

  // Avoid SSR/client hydration mismatch: localStorage & URL are client-only.
  // useSyncExternalStore is the React-recommended way to read client-only state.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true, // client
    () => false // server
  );

  // Strip ?token= from the URL after mount (so it doesn't linger in history).
  // Done in an effect (not during render) for reliability across routers.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("token")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  }, []);

  // Persist region/isDemo/autoConnect whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(REGION_KEY, region);
      localStorage.setItem(DEMO_KEY, String(isDemo));
      localStorage.setItem(AUTOCONNECT_KEY, String(autoConnect));
    } catch {}
  }, [region, isDemo, autoConnect]);

  // Auto-connect on first mount:
  //   - if a token exists (from URL grab OR saved with autoConnect=true)
  //   - and the user didn't explicitly disconnect this session
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("expertbot.skipAuto")) {
      sessionStorage.removeItem("expertbot.skipAuto");
      return;
    }
    const s = loadSaved();
    // token state already holds URL-or-saved token; autoConnect flag decides
    const shouldConnect = token && (s?.autoConnect || token === s?.token);
    if (shouldConnect && !connecting) {
      useExpertStore.getState().setConnecting(true);
      useExpertStore.getState().setConnectionError(null);
      useExpertStore.getState().setRegion(region);
      socket.emit("expert:connect", {
        token,
        region,
        isDemo,
      });
    }
  }, [socket, connecting, token, region, isDemo]);

  const handleConnect = () => {
    const t = token || manualToken;
    if (!t.trim()) return;
    setToken(t.trim());
    try {
      localStorage.setItem(TOKEN_KEY, t.trim());
      localStorage.setItem(AUTOCONNECT_KEY, "true");
    } catch {}
    useExpertStore.getState().setConnecting(true);
    useExpertStore.getState().setConnectionError(null);
    useExpertStore.getState().setRegion(region);
    socket.emit("expert:connect", { token: t.trim(), region, isDemo });
  };

  const handleClearSaved = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(AUTOCONNECT_KEY);
    } catch {}
    setToken("");
    setManualToken("");
    setAutoConnect(false);
    useExpertStore.getState().setConnectionError(null);
  };

  const maskedToken = token
    ? token.slice(0, 6) + "••••••••" + token.slice(-4)
    : "";

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
                بوت تداول Expert Option الآلي — توكن تلقائي
              </p>
            </div>
          </div>

          {/* Mount guard: client-only content below (avoids hydration mismatch
              from reading localStorage / window.location during render). */}
          {mounted && (
            <>
          {/* === Saved-token quick reconnect === */}
          {token && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-200">
                      توكن محفوظ على هذا الجهاز
                    </div>
                    <div className="font-mono text-[11px] text-emerald-400/80" dir="ltr">
                      {maskedToken}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold h-10 gap-1.5"
                >
                  {connecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  اتصال
                </Button>
              </div>
              <button
                onClick={handleClearSaved}
                className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300 transition"
              >
                <Trash2 className="size-3" />
                مسح التوكن المحفوظ
              </button>
            </div>
          )}

          {/* === Get token: mobile-first approach === */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="size-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                الحصول على التوكن
              </h2>
            </div>

            {/* Step 1: open Expert Option */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                  ١
                </span>
                <div className="flex-1 space-y-2">
                  <p className="text-[12px] leading-relaxed text-zinc-300">
                    افتح منصة Expert Option وسجّل دخولك:
                  </p>
                  <a
                    href="https://app.expertoption.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20 active:scale-[0.98]"
                  >
                    <ExternalLink className="size-4" />
                    فتح Expert Option
                  </a>
                </div>
              </div>

              {/* Step 2: copy token via in-page guide */}
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                  ٢
                </span>
                <div className="flex-1">
                  <p className="text-[12px] leading-relaxed text-zinc-300">
                    بعد تسجيل الدخول، اضغط{" "}
                    <strong className="text-emerald-300">F12</strong> (أو قائمة
                    المتصفح ← أدوات المطور) ← تبويب{" "}
                    <strong className="text-emerald-300">Console</strong> ← ألصق
                    هذا الأمر واضغط Enter:
                  </p>
                  <div className="mt-2 rounded-lg border border-white/10 bg-black/60 p-2.5">
                    <code className="block font-mono text-[10px] leading-relaxed text-emerald-300 break-all" dir="ltr">
                      {CONSOLE_CMD}
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(CONSOLE_CMD)
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                        .catch(() => {});
                    }}
                    className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-300 transition"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        <span className="text-emerald-400">تم النسخ — الصقه في Console</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="size-3" />
                        نسخ الأمر
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 3: paste token */}
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                  ٣
                </span>
                <div className="flex-1 space-y-2">
                  <p className="text-[12px] leading-relaxed text-zinc-300">
                    ارجع هنا وألصق التوكن المنسوخ:
                  </p>
                  <div className="relative">
                    <Input
                      type="text"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !connecting) handleConnect();
                      }}
                      placeholder="ألصق التوكن هنا..."
                      className="bg-black/40 font-mono text-sm border-white/10 text-zinc-100 placeholder:text-zinc-600 h-12 pr-3 pl-20"
                      autoComplete="off"
                      spellCheck={false}
                      dir="ltr"
                    />
                    <button
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            setManualToken(text.trim());
                          }
                        } catch {}
                      }}
                      className="absolute inset-y-0 left-1 my-1 flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition"
                    >
                      <ClipboardCopy className="size-3.5" />
                      لصق
                    </button>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={connecting || !manualToken.trim()}
                    className="w-full h-11 bg-emerald-500 text-black hover:bg-emerald-400 font-semibold gap-2"
                  >
                    {connecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    اتصال
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* === Region + account type === */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            {/* Region */}
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

            {/* Account type */}
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

          {/* Risk warning */}
          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="size-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1.5 text-[12px] leading-relaxed text-red-100/90">
                <p className="font-semibold text-red-200">إقرار المسؤولية</p>
                <p>
                  يتصل التطبيق بخوادم Expert Option الحقيقية. التداول بأموال فعلية
                  يحمل مخاطر مالية كبيرة وقد يخالف شروط الخدمة. أنت تتحمل كامل
                  المسؤولية.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span>ExpertBot Live — بوت تداول آلي</span>
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
