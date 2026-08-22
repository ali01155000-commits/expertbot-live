"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import {
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  LogIn,
  Monitor,
  Smartphone,
  Puzzle,
  QrCode,
  ScanLine,
  ShieldAlert,
  Share,
  Trash2,
  X,
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

/** Detect if the user is on iPhone/iOS. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Detect if running as installed PWA (standalone mode). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
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
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [copied, setCopied] = useState(false);

  // Device detection (lazy init — only runs on client, gated by `mounted` below)
  const [device] = useState<"iphone" | "android" | "desktop">(() =>
    typeof navigator !== "undefined"
      ? isIOS()
        ? "iphone"
        : /Android/i.test(navigator.userAgent)
          ? "android"
          : "desktop"
      : "desktop"
  );

  const connecting = useExpertStore((s) => s.connecting);
  const connectionError = useExpertStore((s) => s.connectionError);

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

  // Listen for postMessage from the browser extension.
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

  // Auto-connect if a saved token exists.
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

  /** Generate a QR code containing the app URL + token. */
  const showQrCode = async () => {
    if (!token) return;
    const appUrl =
      typeof window !== "undefined" ? window.location.origin + "/" : "/";
    const urlWithToken =
      appUrl + (appUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
    try {
      const dataUrl = await QRCode.toDataURL(urlWithToken, {
        width: 320,
        margin: 2,
        color: { dark: "#0a0e14", light: "#10b981" },
      });
      setQrDataUrl(dataUrl);
      setQrOpen(true);
    } catch (e) {
      console.error("QR generation failed:", e);
    }
  };

  const handleClearSaved = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken("");
    setManualToken("");
    useExpertStore.getState().setConnectionError(null);
  };

  const handleManualConnect = () => {
    const t = manualToken.trim();
    if (!t) return;
    connectWithToken(t);
  };

  const openExpertOption = () => {
    window.open("https://app.expertoption.com/", "_blank");
  };

  const copyAppUrl = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
                بوت تداول Expert Option الآلي
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
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={handleClearSaved}
                      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300 transition"
                    >
                      <Trash2 className="size-3" />
                      نسيان الحساب
                    </button>
                    {device === "desktop" && (
                      <button
                        onClick={showQrCode}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-300 transition"
                      >
                        <QrCode className="size-3" />
                        نقل للآيفون (QR)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* === iPhone setup guide (shown when on iPhone WITHOUT token) === */}
              {device === "iphone" && !token && (
                <IPhoneSetupGuide appUrl={typeof window !== "undefined" ? window.location.href : ""} />
              )}

              {/* === Android/desktop: primary login === */}
              {device !== "iphone" && (
                <DesktopLoginSection
                  token={token}
                  extDetected={extDetected}
                  connecting={connecting}
                  connectionError={connectionError}
                  showManual={showManual}
                  manualToken={manualToken}
                  setShowManual={setShowManual}
                  setManualToken={setManualToken}
                  onManualConnect={handleManualConnect}
                  onOpenExpertOption={openExpertOption}
                  onShowQr={showQrCode}
                />
              )}

              {/* === Manual token input (fallback for Android) === */}
              {device === "android" && !token && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <button
                    onClick={() => setShowManual((v) => !v)}
                    className="flex w-full items-center justify-between text-[12px] text-zinc-400 hover:text-zinc-200 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Monitor className="size-3.5" />
                      إدخال يدوي للتوكن (للأندرويد بدون Kiwi)
                    </span>
                    {showManual ? <X className="size-4" /> : <LogIn className="size-4" />}
                  </button>
                  {showManual && (
                    <div className="mt-3 space-y-3">
                      <Input
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !connecting) handleManualConnect();
                        }}
                        placeholder="ألصق التوكن هنا..."
                        className="bg-black/40 font-mono text-sm border-white/10 text-zinc-100 placeholder:text-zinc-600 h-11"
                        autoComplete="off"
                        spellCheck={false}
                        dir="ltr"
                      />
                      <Button
                        onClick={handleManualConnect}
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
                  )}
                </div>
              )}

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

              {/* Risk warning */}
              <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-5 shrink-0 text-red-400 mt-0.5" />
                  <div className="space-y-1.5 text-[12px] leading-relaxed text-red-100/90">
                    <p className="font-semibold text-red-200">إقرار المسؤولية</p>
                    <p>
                      يتصل التطبيق بخوادم Expert Option الحقيقية. التداول بأموال
                      فعلية يحمل مخاطر مالية كبيرة. أنت تتحمل كامل المسؤولية.
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

      {/* === QR Code modal (detailed step-by-step) === */}
      {qrOpen && (
        <QRModal
          qrDataUrl={qrDataUrl}
          onClose={() => setQrOpen(false)}
        />
      )}

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

/* ================================================================== */
/* IPhone Setup Guide — shown when user is on iPhone WITHOUT a token  */
/* ================================================================== */
function IPhoneSetupGuide({ appUrl }: { appUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copyUrl = () => {
    navigator.clipboard?.writeText(appUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Smartphone className="size-5 text-emerald-400" />
        <h2 className="text-base font-semibold text-zinc-100">
          إعداد التطبيق على الآيفون
        </h2>
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-zinc-400">
        آيفون لا يدعم إضافات المتصفح. للحصول على التوكن، تحتاج كمبيوتر واحد
        مرة واحدة فقط، ثم تنقل الجلسة للآيفون عبر QR code.
      </p>

      {/* Step 1: open on computer */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
            ١
          </span>
          <div className="flex-1 space-y-2">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              على <strong className="text-emerald-300">كمبيوتر</strong>، افتح نفس
              هذا التطبيق في المتصفح:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-2.5">
              <code className="flex-1 font-mono text-[11px] text-emerald-300 truncate" dir="ltr">
                {appUrl}
              </code>
              <button
                onClick={copyUrl}
                className="shrink-0 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition"
              >
                {copied ? "✓ نُسخ" : "نسخ"}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              أرسل الرابط لنفسك (واتساب، بريد) وافتحه على الكمبيوتر
            </p>
          </div>
        </div>

        {/* Step 2: login on computer */}
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
            ٢
          </span>
          <div className="flex-1">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              على الكمبيوتر: ثبّت إضافة المتصفح ← افتح Expert Option ← سجل دخولك.
              سيُلتقط التوكن تلقائياً ويفتح التطبيق.
            </p>
          </div>
        </div>

        {/* Step 3: transfer via QR */}
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
            ٣
          </span>
          <div className="flex-1">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              على الكمبيوتر: اضغط زر <strong className="text-emerald-300">«نقل للآيفون (QR)»</strong>{" "}
              ← سيظهر QR code على الشاشة.
            </p>
          </div>
        </div>

        {/* Step 4: scan with iPhone */}
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
            ٤
          </span>
          <div className="flex-1">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              على هذا الآيفون: افتح <strong className="text-emerald-300">الكاميرا</strong>{" "}
              ← وجّهها للـ QR code ← اضغط الإشعار ← يفتح التطبيق متصلاً.
            </p>
          </div>
        </div>

        {/* Step 5: add to home screen */}
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[13px] font-bold text-emerald-400">
            ٥
          </span>
          <div className="flex-1">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              اضغط زر <Share className="inline size-3 text-emerald-300" /> المشاركة
              في Safari ← <strong className="text-emerald-300">«Add to Home Screen»</strong> ←
              أصبح التطبيق على شاشتك الرئيسية كتطبيق أصلي.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-400" />
        <p className="text-[11px] leading-relaxed text-emerald-200/80">
          بعد المرة الأولى: التوكن يُحفظ على الآيفون — لا حاجة للكمبيوتر مرة أخرى.
          افتح التطبيق من الشاشة الرئيسية ويتصل تلقائياً.
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Desktop Login Section — extension + manual + QR transfer           */
/* ================================================================== */
function DesktopLoginSection(props: {
  token: string;
  extDetected: boolean;
  connecting: boolean;
  connectionError: string | null;
  showManual: boolean;
  manualToken: string;
  setShowManual: (v: boolean) => void;
  setManualToken: (v: string) => void;
  onManualConnect: () => void;
  onOpenExpertOption: () => void;
  onShowQr: () => void;
}) {
  const {
    extDetected,
    connecting,
    onOpenExpertOption,
  } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Puzzle className="size-5 text-emerald-400" />
        <h2 className="text-base font-semibold text-zinc-100">
          تسجيل الدخول إلى Expert Option
        </h2>
      </div>

      {/* Extension status */}
      {extDetected ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span className="text-[12px] font-medium text-emerald-200">
            الإضافة مُثبّتة وفعّالة
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3">
          <Puzzle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed text-amber-200">
            <strong>ثبّت إضافة المتصفح</strong> للدخول التلقائي — تحميلها من
            الزر بالأسفل.
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ١
          </span>
          <div className="flex-1 space-y-2">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              ثبّت إضافة «ExpertBot Auto Login»:
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension.zip"}
                download
                target={process.env.NEXT_PUBLIC_EXTENSION_URL ? "_blank" : undefined}
                rel={process.env.NEXT_PUBLIC_EXTENSION_URL ? "noreferrer" : undefined}
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
                  <p className="mb-1.5 font-semibold text-zinc-100">Chrome / Edge:</p>
                  <ol className="ml-4 list-decimal space-y-0.5">
                    <li>افتح <code className="rounded bg-white/5 px-1">chrome://extensions</code></li>
                    <li>فعّل «وضع المطوّر»</li>
                    <li>«تحميل غير مُحزَّم» ← اختر مجلد <code className="rounded bg-white/5 px-1">extension/</code></li>
                  </ol>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٢
          </span>
          <div className="flex-1 space-y-2">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              افتح Expert Option وسجّل دخولك — ستلتقط الإضافة الجلسة تلقائياً:
            </p>
            <Button
              onClick={onOpenExpertOption}
              className="w-full h-11 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
            >
              <ExternalLink className="size-4" />
              فتح Expert Option
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٣
          </span>
          <div className="flex-1">
            <p className="text-[12px] leading-relaxed text-zinc-300">
              بمجرد دخولك، يفتح التطبيق تلقائياً جاهزاً للتداول.
            </p>
          </div>
        </div>
      </div>

      {connecting && (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
          <Loader2 className="size-4 animate-spin text-emerald-400 shrink-0" />
          <span className="text-[12px] text-emerald-200">
            جارٍ الاتصال بـ Expert Option…
          </span>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* QR Modal — detailed step-by-step instructions                      */
/* ================================================================== */
function QRModal({ qrDataUrl, onClose }: { qrDataUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e14] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute left-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex items-center justify-center gap-2">
          <ScanLine className="size-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-zinc-100">
            نقل الجلسة إلى الآيفون
          </h3>
        </div>

        {/* QR Code */}
        {qrDataUrl && (
          <div className="mb-4 flex justify-center">
            <img
              src={qrDataUrl}
              alt="QR code"
              className="rounded-xl border-4 border-emerald-400"
              width={240}
              height={240}
            />
          </div>
        )}

        {/* Detailed step-by-step */}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold text-zinc-200 mb-2">
            اتبع هذه الخطوات بالترتيب:
          </div>

          {/* Step 1 */}
          <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
              ١
            </span>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-zinc-100 mb-0.5">
                افتح الكاميرا على الآيفون
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                من الشاشة الرئيسية للآيفون، اضغط على أيقونة{" "}
                <strong className="text-emerald-300">الكاميرا</strong>.
                لا تحتاج تثبيت أي تطبيق — الكاميرا الأصلية تقرأ QR code.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
              ٢
            </span>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-zinc-100 mb-0.5">
                وجّه الكاميرا نحو الـ QR code
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                وجّه كاميرا الآيفون نحو الـ QR code الظاهر على شاشة الكمبيوتر.
                حافظ على مسافة 15-30 سم. سيظهر{" "}
                <strong className="text-emerald-300">إشعار أصفر</strong> في أعلى
                الشاشة.
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
              ٣
            </span>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-zinc-100 mb-0.5">
                اضغط على الإشعار
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                اضغط على الإشعار الذي ظهر في أعلى الشاشة. سيفتح{" "}
                <strong className="text-emerald-300">Safari</strong> ويحمّل
                التطبيق تلقائياً متصلاً بحسابك — جاهزاً للتداول.
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
              ٤
            </span>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-zinc-100 mb-0.5">
                أضف التطبيق للشاشة الرئيسية
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                في Safari: اضغط زر{" "}
                <Share className="inline size-3 text-emerald-300" /> المشاركة
                (أسفل الشاشة) ← مرّر واختر{" "}
                <strong className="text-emerald-300">«Add to Home Screen»</strong>{" "}
                ← اضغط «إضافة». ✅
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[12px] font-bold text-black">
              ✓
            </span>
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-emerald-200 mb-0.5">
                تم! استخدم التطبيق
              </div>
              <div className="text-[11px] text-emerald-300/80 leading-relaxed">
                الآن لديك أيقونة <strong>ExpertBot</strong> على شاشتك الرئيسية.
                اضغطها في أي وقت لفتح التطبيق — سيتصل تلقائياً بحسابك ويبدأ
                التداول. لا حاجة لمسح QR مرة أخرى.
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[11px] font-semibold text-zinc-300 mb-1.5">
            💡 نصائح:
          </div>
          <ul className="space-y-1 text-[10px] text-zinc-400 leading-relaxed">
            <li>• إذا لم تظهر الكاميرا الإشعار: افتح Settings ← Camera ← فعّل «Scan QR Codes»</li>
            <li>• بدلاً من الكاميرا، يمكنك استخدام تطبيق QR reader مجاني من App Store</li>
            <li>• الـ QR صالح لمدة جلسة Expert Option — إذا انتهت الجلسة، كرّر العملية</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
