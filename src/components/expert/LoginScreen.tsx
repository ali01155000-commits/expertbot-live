"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import {
  Bot,
  BookOpen,
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
  getExpertSocket,
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
  const [guideOpen, setGuideOpen] = useState(false);
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

  // Auto-connect: if a token exists (from URL invite or saved), connect immediately
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;
    // رابط الدعوة: تجاوز skipAuto (العميل يجب أن يتصل فوراً)
    const fromInvite =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("token");
    if (!fromInvite && typeof sessionStorage !== "undefined" && sessionStorage.getItem("expertbot.skipAuto")) {
      sessionStorage.removeItem("expertbot.skipAuto");
      return;
    }
    if (token && !connecting) {
      connectWithToken(token);
    }
  }, [token, connecting, connectWithToken]);

  // If token came from URL (invite link), show a connecting screen
  const fromInvite =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("token");

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

  // If token came from URL (invite link), show a connecting screen
  if (fromInvite && token && connecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0e14] gap-4">
        <Loader2 className="size-12 animate-spin text-emerald-400" />
        <p className="text-lg font-bold text-zinc-100">جارٍ الاتصال بـ Expert Option...</p>
        <p className="text-sm text-zinc-400">سيفتح البوت خلال ثوانٍ</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100">
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 expert-grid-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,14,20,0.85)_70%,_#0a0e14_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-5">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Hero image */}
            <div className="relative mx-auto flex justify-center">
              <div className="absolute inset-0 -z-10 blur-3xl bg-emerald-500/20 rounded-full" />
              <img
                src="/bot-hero.png"
                alt="ExpertBot AI"
                className="h-40 w-auto rounded-2xl object-cover ring-2 ring-emerald-500/30 shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)]"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Expert<span className="text-emerald-400">Bot</span> Live
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                بوت تداول Expert Option الآلي
              </p>
            </div>
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15 transition"
            >
              <BookOpen className="size-3.5" />
              دليل التثبيت الكامل
            </button>
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

      {/* === Full installation guide modal === */}
      {guideOpen && (
        <GuideModal
          extensionUrl={process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension.zip"}
          onClose={() => setGuideOpen(false)}
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
    <div className="space-y-4">
      {/* Big title */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
        <QrCode className="size-16 mx-auto text-emerald-400 mb-3" />
        <h2 className="text-2xl font-bold text-zinc-100">
          امسح QR Code
        </h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          لتفعيل البوت على الآيفون، امسح QR Code من الكمبيوتر
        </p>
      </div>

      {/* Step 1 — big card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-black">
            ١
          </span>
          <h3 className="text-base font-bold text-emerald-200">
            افتح هذا التطبيق على كمبيوتر
          </h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed mb-3">
          انسخ هذا الرابط وافتحه على كمبيوترك:
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-3">
          <code className="flex-1 font-mono text-xs text-emerald-300 truncate" dir="ltr">
            {appUrl}
          </code>
          <button
            onClick={copyUrl}
            className="shrink-0 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition"
          >
            {copied ? "✓" : "نسخ"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          أرسله لنفسك عبر واتساب أو بريد وافتحه على الكمبيوتر
        </p>
      </div>

      {/* Step 2 — big card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-black">
            ٢
          </span>
          <h3 className="text-base font-bold text-zinc-100">
            على الكمبيوتر: سجّل دخولك
          </h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          على الكمبيوتر: ادفع الاشتراك ← أدخل كود التفعيل ← سجّل دخول Expert Option.
          سيظهر زر <strong className="text-emerald-300">«نقل للآيفون (QR)»</strong> —
          اضغطه لإنشاء QR Code على الشاشة.
        </p>
      </div>

      {/* Step 3 — big card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-black">
            ٣
          </span>
          <h3 className="text-base font-bold text-emerald-200">
            على الآيفون: امسح QR Code
          </h3>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed">
          افتح <strong className="text-emerald-300">الكاميرا</strong> على آيفونك ←
          وجّهها نحو QR Code على شاشة الكمبيوتر ← اضغط الإشعار ←
          سيفتح التطبيق <strong className="text-emerald-300">جاهزاً للتداول</strong>.
        </p>
      </div>

      {/* Step 4 — big card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-black">
            ٤
          </span>
          <h3 className="text-base font-bold text-zinc-100">
            أضف للتطابق للشاشة الرئيسية
          </h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          في Safari: اضغط زر المشاركة <Share className="inline size-4 text-emerald-300" /> ←
          اختر <strong className="text-emerald-300">«Add to Home Screen»</strong> ←
          اضغط «إضافة». ✅
        </p>
      </div>

      {/* Done */}
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.1] p-5 text-center">
        <CheckCircle2 className="size-10 mx-auto text-emerald-400 mb-2" />
        <h3 className="text-base font-bold text-emerald-200">
          تم! استخدم البوت من شاشتك
        </h3>
        <p className="mt-1 text-sm text-emerald-100/80 leading-relaxed">
          بعد المرة الأولى: افتح التطبيق من الأيقونة — سيتصل تلقائياً.
          لا تحتاج كمبيوتر مرة أخرى.
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
    token,
    connecting,
    connectionError,
    manualToken,
    setManualToken,
    onManualConnect,
    onShowQr,
  } = props;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
        <LogIn className="size-12 mx-auto text-emerald-400 mb-3" />
        <h2 className="text-2xl font-bold text-zinc-100">
          تسجيل الدخول
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          اضغط الزر بالأسفل، سجّل دخولك في Expert Option، وسيتم الاتصال تلقائياً
        </p>
      </div>

      {/* One big button — opens EO + auto-captures token */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
        <Button
          onClick={() => {
            // افتح Expert Option في نافذة منبثقة
            const popup = window.open(
              "https://app.expertoption.com/",
              "expertoption",
              "width=1200,height=800"
            );

            // أظهر رسالة انتظار
            alert(
              "جارٍ فتح Expert Option...\n\n" +
              "سجّل دخولك في النافذة التي فتحت.\n" +
              "بعد تسجيل الدخول، ارجع لهذه الصفحة واضغط زر \"التقط التوكن\" بالأسفل."
            );
          }}
          className="w-full h-14 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-base"
        >
          <ExternalLink className="size-6" />
          افتح Expert Option
        </Button>
      </div>

      {/* Step 2 — capture token automatically */}
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-lg font-bold text-white">
            2
          </span>
          <h3 className="text-base font-bold text-zinc-100">
            بعد تسجيل الدخول، التقط التوكن
          </h3>
        </div>
        <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
          بعد تسجيل دخولك في Expert Option، ارجع هنا واضغط:
        </p>
        <AutoCaptureToken />
      </div>

      {/* QR for iPhone */}
      {token && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-5">
          <div className="flex items-center gap-3 mb-3">
            <QrCode className="size-6 text-sky-400" />
            <h3 className="text-base font-bold text-sky-200">
              لديك آيفون؟ انقل الجلسة
            </h3>
          </div>
          <button
            onClick={onShowQr}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-400 transition"
          >
            <QrCode className="size-5" />
            إنشاء QR Code
          </button>
        </div>
      )}

      {connecting && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
          <Loader2 className="size-4 animate-spin text-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-200">جارٍ الاتصال...</span>
        </div>
      )}

      {connectionError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
          <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
          <span className="font-mono">{connectionError}</span>
        </div>
      )}
    </div>
  );
}

/* --- Auto-capture token component --- */
function AutoCaptureToken() {
  const [status, setStatus] = useState<"idle" | "copied" | "waiting">("idle");
  const [manualToken, setManualToken] = useState("");

  const CONSOLE_CMD = `(function(){
    var t=null;
    // 1. ابحث في localStorage بمفاتيح متعددة
    try{t=JSON.parse(localStorage.getItem('auth')||'{}').token}catch(e){}
    if(!t)try{t=localStorage.getItem('token')}catch(e){}
    if(!t)try{t=localStorage.getItem('auth_token')}catch(e){}
    if(!t)try{t=localStorage.getItem('session')}catch(e){}
    if(!t){
      try{
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i),v=localStorage.getItem(k);
          if(v&&v.length>=20&&v.length<=80&&/^[a-f0-9]+$/i.test(v)){t=v;break}
        }
      }catch(e){}
    }
    // 2. ابحث في cookies
    if(!t){
      try{
        var m=document.cookie.match(/(?:^|;\\s*)([a-f0-9]{24,})/i);
        if(m)t=m[1];
      }catch(e){}
    }
    // 3. ابحث في WebSocket messages
    if(!t&&!window.__eoHook){
      window.__eoHook=1;
      var orig=WebSocket.prototype.send;
      WebSocket.prototype.send=function(d){
        try{
          var s=typeof d==='string'?d:new TextDecoder().decode(d);
          var m=s.match(/"token"\\s*:\\s*"([a-f0-9]{20,})"/);
          if(m&&m[1]){copy(m[1]);alert('تم التقاط التوكن! ارجع للتطبيق والصقه.')}
        }catch(e){}
        return orig.apply(this,arguments);
      };
      alert('لم يتم العثور على التوكن بعد. تفاعل مع Expert Option (اضغط أي زر أو افتح صفقة) وسيتم التقاطه تلقائياً.');
      return;
    }
    if(t){copy(t);alert('تم التقاط التوكن! ارجع للتطبيق والصقه.')}
    else{alert('لم يتم العثور على التوكن. تأكد أنك سجلت دخولك في Expert Option.')}
  })()`;

  const capture = () => {
    // انسخ أمر بسيط جداً — يطبع كل localStorage
    navigator.clipboard?.writeText("copy(JSON.stringify(localStorage))").then(() => {
      setStatus("copied");
    });

    // افتح Expert Option
    window.open("https://app.expertoption.com/", "expertoption", "width=1200,height=800");

    // أظهر تعليمات بسيطة جداً
    setStatus("waiting");
    alert(
      "تم نسخ أمر بسيط!\n\n" +
      "في نافذة Expert Option:\n" +
      "1. اضغط F12\n" +
      "2. اضغط Console\n" +
      "3. اضغط Ctrl+V ثم Enter\n\n" +
      "سيتم نسخ كل البيانات. ارجع هنا والصقها."
    );
  };

  const handleConnect = () => {
    if (!manualToken.trim()) return;
    const socket = getExpertSocket();
    if (socket) {
      useExpertStore.getState().setConnecting(true);
      useExpertStore.getState().setConnectionError(null);
      socket.emit("expert:connect", {
        token: manualToken.trim(),
        region: "EUROPE",
        isDemo: true,
      });
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={capture}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white hover:bg-violet-400 transition"
      >
        <Zap className="size-5" />
        {status === "copied" ? "✓ نُسخ — الصق في Console" : "التقط التوكن تلقائياً"}
      </button>

      {status === "waiting" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-[11px] text-amber-200 leading-relaxed">
          بعد لصق الأمر في Console، سينسخ التوكن تلقائياً. ارجع هنا والصقه:
        </div>
      )}

      <div className="relative">
        <Input
          type="text"
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualToken.trim()) handleConnect();
          }}
          placeholder="ألصق التوكن هنا..."
          className="bg-black/40 font-mono text-sm border-white/10 text-zinc-100 placeholder:text-zinc-600 h-12"
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
        />
      </div>

      <Button
        onClick={handleConnect}
        disabled={!manualToken.trim()}
        className="w-full h-12 bg-emerald-500 text-black hover:bg-emerald-400 font-bold gap-2"
      >
        <LogIn className="size-5" />
        اتصال وبدء التداول
      </Button>
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

/* ================================================================== */
/* Guide Modal — full step-by-step installation + bot usage guide     */
/* ================================================================== */
function GuideModal({
  extensionUrl,
  onClose,
}: {
  extensionUrl: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"extension" | "bot">("extension");
  const [browser, setBrowser] = useState<"chrome" | "firefox">("chrome");
  const [copied, setCopied] = useState(false);

  const copyExtUrl = () => {
    const url =
      typeof window !== "undefined" ? window.location.origin + extensionUrl : extensionUrl;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e14]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a0e14]/95 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100">
              دليل التثبيت والاستخدام
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 px-5 pt-3">
          <button
            onClick={() => setTab("extension")}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[12px] font-medium transition ${
              tab === "extension"
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Puzzle className="size-3.5" />
            ١. تثبيت الإضافة
          </button>
          <button
            onClick={() => setTab("bot")}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-[12px] font-medium transition ${
              tab === "bot"
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Bot className="size-3.5" />
            ٢. تشغيل البوت
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(92vh-100px)] overflow-y-auto p-5">
          {tab === "extension" ? (
            <ExtensionGuide
              browser={browser}
              setBrowser={setBrowser}
              extensionUrl={extensionUrl}
              copied={copied}
              onCopy={copyExtUrl}
            />
          ) : (
            <BotGuide />
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Extension installation guide --- */
function ExtensionGuide({
  browser,
  setBrowser,
  extensionUrl,
  copied,
  onCopy,
}: {
  browser: "chrome" | "firefox";
  setBrowser: (b: "chrome" | "firefox") => void;
  extensionUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
        <p className="text-[12px] leading-relaxed text-emerald-200/90">
          🤖 <strong>الإضافة</strong> أداة صغيرة تُثبّت على متصفحك. وظيفتها: التقاط
          جلسة Expert Option تلقائياً عند تسجيل دخولك، وفتح البوت جاهزاً للتداول —{" "}
          <strong>بدون نسخ أو لصق</strong>.
        </p>
      </div>

      {/* Step 1: download */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ١
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">حمّل ملف الإضافة</h4>
        </div>
        <div className="ms-9 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            اضغط الزر لتحميل <code className="rounded bg-white/5 px-1 text-emerald-300">extension.zip</code>:
          </p>
          <div className="flex items-center gap-2">
            <a
              href={extensionUrl}
              download
              target={extensionUrl.startsWith("http") ? "_blank" : undefined}
              rel={extensionUrl.startsWith("http") ? "noreferrer" : undefined}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <Download className="size-3.5" />
              تحميل extension.zip
            </a>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
            >
              {copied ? "✓ نُسخ" : "نسخ الرابط"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">الملف ~7KB — آمن ومفتوح المصدر</p>
        </div>
      </div>

      {/* Step 2: unzip */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٢
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">فك ضغط الملف</h4>
        </div>
        <div className="ms-9">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            اضغط بالزر الأيمن على <code className="rounded bg-white/5 px-1">extension.zip</code> ←
            «استخراج الكل» (Extract All). ستحصل على مجلد{" "}
            <code className="rounded bg-white/5 px-1">extension/</code>.
          </p>
        </div>
      </div>

      {/* Step 3: browser-specific install */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٣
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">ثبّت الإضافة على متصفحك</h4>
        </div>

        <div className="ms-9">
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setBrowser("chrome")}
              className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                browser === "chrome"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-black/30 text-zinc-400"
              }`}
            >
              Chrome / Edge
            </button>
            <button
              onClick={() => setBrowser("firefox")}
              className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
                browser === "firefox"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-black/30 text-zinc-400"
              }`}
            >
              Firefox
            </button>
          </div>

          {browser === "chrome" ? (
            <ol className="space-y-2.5 text-[11px] leading-relaxed text-zinc-300">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.1</span>
                <span>
                  افتح المتصفح واذهب للعنوان:{" "}
                  <code className="rounded bg-white/5 px-1 text-emerald-300" dir="ltr">
                    chrome://extensions
                  </code>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.2</span>
                <span>
                  في أعلى يمين الصفحة، فعّل المفتاح{" "}
                  <strong className="text-emerald-300">«Developer mode»</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.3</span>
                <span>
                  سيظهر زر <strong className="text-emerald-300">«Load unpacked»</strong>{" "}
                  في أعلى اليسار — اضغطه
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.4</span>
                <span>
                  اختر مجلد <code className="rounded bg-white/5 px-1">extension/</code> الذي
                  فككت ضغطه
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.5</span>
                <span>
                  ✅ ستظهر الإضافة! ثبّتها في شريط المتصفح (انقر 🧩 ← 📌 بجانب ExpertBot)
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-2.5 text-[11px] leading-relaxed text-zinc-300">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.1</span>
                <span>
                  افتح Firefox واذهب للعنوان:{" "}
                  <code className="rounded bg-white/5 px-1 text-emerald-300" dir="ltr">
                    about:debugging
                  </code>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.2</span>
                <span>
                  من القائمة اليسرى، اختر <strong className="text-emerald-300">«This Firefox»</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.3</span>
                <span>
                  اضغط زر <strong className="text-emerald-300">«Load Temporary Add-on...»</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.4</span>
                <span>
                  اختر ملف <code className="rounded bg-white/5 px-1">manifest.json</code> داخل
                  مجلد <code className="rounded bg-white/5 px-1">extension/</code>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400 shrink-0">3.5</span>
                <span>
                  ✅ الإضافة مثبّتة! (ملاحظة: Firefox يحذف الإضافات المؤقتة عند الإغلاق)
                </span>
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* Step 4: configure bot URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٤
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">اضبط رابط البوت</h4>
        </div>
        <div className="ms-9 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            اضغط أيقونة الإضافة 🤖 في شريح المتصفح ← في حقل{" "}
            <strong className="text-emerald-300">«رابط التطبيق»</strong>، أدخل:
          </p>
          <div className="rounded-lg border border-white/10 bg-black/40 p-2.5">
            <code className="text-[11px] text-emerald-300" dir="ltr">
              {typeof window !== "undefined" ? window.location.origin + "/" : "https://your-domain.com/"}
            </code>
          </div>
          <p className="text-[10px] text-zinc-500">يُحفظ تلقائياً ✓ — لا تعديل كود</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-400" />
        <div className="text-[11px] leading-relaxed text-emerald-200">
          <strong>تم تثبيت الإضافة!</strong> انتقل لتبويب «٢. تشغيل البوت».
        </div>
      </div>
    </div>
  );
}

/* --- Bot usage guide --- */
function BotGuide() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
        <p className="text-[12px] leading-relaxed text-emerald-200/90">
          🎯 <strong>البوت</strong> يتصل بـ Expert Option وينفّذ صفقات Buy/Sell آلياً
          حسب الإستراتيجية التي تختارها.
        </p>
      </div>

      {/* Step 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ١
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">افتح Expert Option وسجّل دخولك</h4>
        </div>
        <div className="ms-9 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            اذهب إلى{" "}
            <a
              href="https://app.expertoption.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              app.expertoption.com
              <ExternalLink className="size-3" />
            </a>{" "}
            وسجّل دخولك كالمعتاد.
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
            <span className="text-emerald-400 shrink-0">⚡</span>
            <p className="text-[11px] leading-relaxed text-emerald-200/90">
              بمجرد دخولك، الإضافة ستلتقط الجلسة <strong>تلقائياً</strong> وتفتح
              التطبيق في تبويب جديد!
            </p>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٢
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">التطبيق يفتح تلقائياً</h4>
        </div>
        <div className="ms-9">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            سيفتح البوت في تبويب جديد، وسترى لوحة التداول كاملة:
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-300">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              الرصيد الحالي + الإحصائيات
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              رسم شموع يابانية حي
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              لوحة تحكم البوت + تداول يدوي
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              سجل الصفقات + النشاط
            </li>
          </ul>
        </div>
      </div>

      {/* Step 3 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٣
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">اختر إعدادات البوت</h4>
        </div>
        <div className="ms-9 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            في تبويب <strong className="text-emerald-300">«البوت»</strong>:
          </p>
          <div className="space-y-1.5 text-[11px] text-zinc-300">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <strong className="text-emerald-300">الإستراتيجية:</strong>{" "}
              متابعة الاتجاه / RSI / تقاطع المتوسطات / Alligator
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <strong className="text-emerald-300">قيمة الرهان:</strong>{" "}
              المبلغ بالدولار لكل صفقة
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <strong className="text-emerald-300">مدة الصفقة:</strong>{" "}
              15 / 30 / 60 / 120 / 300 ثانية
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <strong className="text-emerald-300">مارتينجال:</strong>{" "}
              (اختياري) مضاعفة الرهان بعد الخسارة
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٤
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">شغّل البوت</h4>
        </div>
        <div className="ms-9 space-y-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            اضغط الزر الأخضر الكبير:{" "}
            <strong className="text-emerald-300">«▶ تشغيل البوت»</strong>
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-2.5">
            <span className="text-violet-400 shrink-0">🤖</span>
            <p className="text-[11px] leading-relaxed text-violet-200/90">
              سيبدأ البوت بتحليل السوق آلياً. عند ظهور إشارة، سينفّذ صفقة Buy أو Sell{" "}
              <strong>تلقائياً</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Step 5 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٥
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">تداول يدوي (اختياري)</h4>
        </div>
        <div className="ms-9">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            في تبويب <strong className="text-emerald-300">«تداول»</strong>، استخدم زرّي:
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center">
              <div className="text-[20px]">▲</div>
              <div className="text-[11px] font-bold text-emerald-300">شراء CALL</div>
              <div className="text-[9px] text-zinc-500">رهان على الصعود</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-center">
              <div className="text-[20px]">▼</div>
              <div className="text-[11px] font-bold text-red-300">بيع PUT</div>
              <div className="text-[9px] text-zinc-500">رهان على الهبوط</div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 6 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-400">
            ٦
          </span>
          <h4 className="text-[13px] font-semibold text-zinc-100">راقب الصفقات</h4>
        </div>
        <div className="ms-9 space-y-1.5">
          <ul className="space-y-1 text-[11px] text-zinc-300">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              تبويب <strong className="text-emerald-300">«الصفقات»</strong>: المفتوحة بعدّاد تنازلي
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              تبويب <strong className="text-emerald-300">«السجل»</strong>: المغلقة + سجل النشاط
            </li>
          </ul>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
        <div className="mb-1.5 text-[11px] font-semibold text-amber-200">💡 نصائح مهمة</div>
        <ul className="space-y-1 text-[10px] leading-relaxed text-amber-100/80">
          <li>• ابدأ دائماً بالحساب التجريبي (Demo) للتجربة</li>
          <li>• استخدم رهانات صغيرة (10-25$) في البداية</li>
          <li>• تابع البوت في أول ساعة لترى كيف يعمل</li>
          <li>• مارتينجال يضاعف المخاطر — استخدمه بحذر</li>
          <li>• البوت يعمل 24/7 على السيرفر حتى وأنت نائم</li>
        </ul>
      </div>

      <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] p-3">
        <div className="mb-1 flex items-center gap-2">
          <ShieldAlert className="size-4 text-red-400" />
          <span className="text-[11px] font-semibold text-red-200">⚠️ تنبيه مخاطر</span>
        </div>
        <p className="text-[10px] leading-relaxed text-red-100/80">
          التداول بأموال فعلية يحمل مخاطر مالية كبيرة. قد تخسر رأس مالك بالكامل.
          استخدم البوت بمسؤوليتك الكاملة.
        </p>
      </div>
    </div>
  );
}
