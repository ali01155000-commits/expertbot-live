"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Send,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useExpertStore } from "@/lib/expert-store";

// ===== إعدادات الدفع =====
const WALLETS = {
  BEP20: {
    label: "BEP20 (BSC)",
    address: "0x01338E0788D52C0cA35C36aB7281Cf3e6B4780Bd",
    short: "0x0133...80Bd",
    color: "#fbbf24", // amber
    desc: "شبكة Binance Smart Chain — رسوم منخفضة",
  },
  TRC20: {
    label: "TRC20 (Tron)",
    address: "TGGsJVHMbWwXmzNNXcrhmeHMd7Z3w8t5dx",
    short: "TGGs...t5dx",
    color: "#ef4444", // red
    desc: "شبكة Tron — رسوم منخفضة جداً",
  },
} as const;

const AMOUNT_USD = 150;
const TELEGRAM = "@ALFa_proo";
const TELEGRAM_URL = "https://t.me/ALFa_proo";

type Network = keyof typeof WALLETS;

export default function BinancePaymentScreen() {
  const setPaid = useExpertStore((s) => s.setPaid);
  const setActivated = useExpertStore((s) => s.setActivated);

  const [network, setNetwork] = useState<Network>("BEP20");
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"instructions" | "sent">("instructions");

  const wallet = WALLETS[network];

  // Regenerate QR code when network changes
  useEffect(() => {
    QRCode.toDataURL(wallet.address, {
      width: 220,
      margin: 1,
      color: { dark: "#0a0e14", light: wallet.color },
    }).then(setQrUrl).catch(() => {});
  }, [network, wallet.address, wallet.color]);

  const copyAddress = () => {
    navigator.clipboard?.writeText(wallet.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // === Waiting screen ===
  if (step === "sent") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="pointer-events-none absolute inset-0 activation-grid-bg" />
        <div className="relative z-10 w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-500/10 ring-2 ring-amber-500/30">
            <Clock className="size-10 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">بانتظار التأكيد</h2>
            <p className="mt-2 text-sm text-zinc-400">
              تم تسجيل طلبك. سيتم تفعيل حسابك خلال دقائق بعد تأكيد الدفعة.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-right space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">المبلغ:</span>
              <span className="font-bold text-amber-300">{AMOUNT_USD} $ USDT</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">الشبكة:</span>
              <span className="font-mono text-amber-300">{wallet.label}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">الحالة:</span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                قيد المراجعة
              </span>
            </div>
          </div>

          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white hover:bg-[#1d8bbf] transition"
          >
            <Send className="size-4" />
            تواصل مع المسؤول على تيليجرام
          </a>

          <button
            onClick={() => setStep("instructions")}
            className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition mx-auto"
          >
            <ArrowLeft className="size-3" />
            العودة للتعليمات
          </button>
        </div>
      </div>
    );
  }

  // === Payment instructions screen ===
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 activation-grid-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,14,20,0.85)_70%,_#0a0e14_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-5">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
              <Wallet className="size-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">شحن رصيد الاشتراك</h1>
              <p className="mt-1 text-sm text-zinc-400">
                قيمة الاشتراك: <strong className="text-amber-300">{AMOUNT_USD} $</strong> · مدة الاشتراك: شهر كامل
              </p>
            </div>
          </div>

          {/* Payment card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl space-y-5">
            {/* Amount */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-center">
              <div className="text-[11px] text-zinc-400">المبلغ المطلوب تحويله</div>
              <div className="mt-1 text-3xl font-bold text-amber-300">
                {AMOUNT_USD} <span className="text-base">USDT</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">≈ {AMOUNT_USD} دولار أمريكي</div>
            </div>

            {/* Network selector */}
            <div className="space-y-2">
              <label className="text-[11px] text-zinc-400">اختر الشبكة</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(WALLETS) as Network[]).map((net) => {
                  const w = WALLETS[net];
                  const active = network === net;
                  return (
                    <button
                      key={net}
                      onClick={() => setNetwork(net)}
                      className={`rounded-xl border p-3 text-right transition ${
                        active
                          ? "border-amber-500/50 bg-amber-500/10"
                          : "border-white/10 bg-black/30 hover:border-white/20"
                      }`}
                    >
                      <div className={`text-[13px] font-bold ${active ? "text-amber-300" : "text-zinc-300"}`}>
                        {w.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{w.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wallet address */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">عنوان المحفظة ({wallet.label})</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: `${wallet.color}20`, color: wallet.color }}
                >
                  {wallet.label}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-[11px]"
                  style={{ color: wallet.color }}
                  dir="ltr"
                >
                  {wallet.address}
                </code>
                <button
                  onClick={copyAddress}
                  className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-amber-300 hover:bg-amber-500/20 transition"
                  title="نسخ العنوان"
                >
                  {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
              {copied && (
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> تم نسخ العنوان
                </div>
              )}
            </div>

            {/* QR code */}
            <div className="flex flex-col items-center gap-2">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR ${wallet.label}`}
                  className="rounded-xl border-4"
                  style={{ borderColor: wallet.color }}
                  width={180}
                  height={180}
                />
              ) : (
                <div className="size-44 animate-pulse rounded-xl bg-amber-500/10" />
              )}
              <p className="text-[10px] text-zinc-500">
                امسح الـ QR من تطبيق Binance للتحويل السريع ({wallet.label})
              </p>
            </div>

            {/* Network warning */}
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] p-3">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
              <div className="text-[11px] leading-relaxed text-red-200">
                <strong>تحذير مهم:</strong> تأكد من اختيار شبكة{" "}
                <strong className="text-red-300">{wallet.label}</strong> عند التحويل.
                التحويل لشبكة خاطئة سيؤدي لفقدان المبلغ!
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2.5">
              <h3 className="flex items-center gap-2 text-[12px] font-semibold text-zinc-200">
                <CheckCircle2 className="size-4 text-emerald-400" />
                خطوات الدفع
              </h3>
              <ol className="space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">١.</span>
                  <span>افتح تطبيق <strong className="text-zinc-200">Binance</strong> ← السحب ← إرسال USDT</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">٢.</span>
                  <span>اختر شبكة <strong style={{ color: wallet.color }}>{wallet.label}</strong> والصق عنوان المحفظة بالأعلى</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">٣.</span>
                  <span>أدخل المبلغ: <strong className="text-amber-300">{AMOUNT_USD} USDT</strong> وأكّد التحويل</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">٤.</span>
                  <span>بعد التحويل، خذ <strong className="text-zinc-200">Screenshot</strong> لإثبات الدفعة</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">٥.</span>
                  <span>أرسل الصورة لحساب تيليجرام المسؤول: <strong className="text-[#229ED9]">{TELEGRAM}</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-400 shrink-0">٦.</span>
                  <span>بعد التأكيد، سيُفعّل حسابك خلال <strong className="text-zinc-200">دقائق</strong></span>
                </li>
              </ol>
            </div>

            {/* Telegram button */}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white hover:bg-[#1d8bbf] transition shadow-lg shadow-[#229ED9]/20"
            >
              <Send className="size-4" />
              فتح محادثة تيليجرام: {TELEGRAM}
              <ExternalLink className="size-3" />
            </a>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setActivated(false)}
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition"
              >
                رجوع
              </button>
              <button
                onClick={() => setStep("sent")}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-[12px] font-bold text-black hover:bg-emerald-400 transition flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="size-3.5" />
                أرسلت السكرين شوت
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" />
              دفع آمن
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" />
              تفعيل سريع
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" />
              دعم 24/7
            </span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .activation-grid-bg {
          background-image:
            linear-gradient(rgba(245, 158, 11, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 158, 11, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: activation-grid-pan 20s linear infinite;
        }
        @keyframes activation-grid-pan {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 40px 40px, 40px 40px; }
        }
      `}</style>
    </div>
  );
}
