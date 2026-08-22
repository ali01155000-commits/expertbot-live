"use client";

import { useState } from "react";
import {
  Bot,
  KeyRound,
  Loader2,
  LogIn,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpertStore } from "@/lib/expert-store";

const ACTIVATION_KEY = "expertbot.activation";

export default function ActivationScreen() {
  const setActivated = useExpertStore((s) => s.setActivated);
  const setActivationCode = useExpertStore((s) => s.setActivationCode);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("أدخل كود التفعيل");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          usedByNote:
            typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 100)
              : "web",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || "كود غير صالح");
        setLoading(false);
        return;
      }

      // نجح التفعيل — احفظ الحالة
      try {
        localStorage.setItem(ACTIVATION_KEY, trimmed);
      } catch {}
      setActivationCode(trimmed);
      setActivated(true);
    } catch (err) {
      setError("تعذّر الاتصال بالخادم — حاول مرة أخرى");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0e14] text-zinc-100">
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 activation-grid-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,14,20,0.85)_70%,_#0a0e14_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5">
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
                تفعيل الحساب
              </p>
            </div>
          </div>

          {/* Activation card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-xl space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                أدخل كود التفعيل
              </h2>
            </div>

            <p className="text-[12px] leading-relaxed text-zinc-400">
              للدخول إلى البوت، تحتاج كود تفعيل صالح. أدخل الكود الذي حصلت عليه:
            </p>

            <div className="space-y-2">
              <div className="relative">
                <KeyRound className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-400" />
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="bg-black/40 font-mono text-sm border-white/10 text-zinc-100 placeholder:text-zinc-600 pr-10 h-12 text-center tracking-widest"
                  autoComplete="off"
                  spellCheck={false}
                  dir="ltr"
                  maxLength={19}
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-[11px] text-red-200">
                  <ShieldAlert className="size-3.5 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full h-12 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-base shadow-[0_0_30px_-5px_rgba(16,185,129,0.6)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <LogIn className="size-5" />
              )}
              تفعيل ودخول
            </Button>
          </form>

          {/* Help */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-2 text-[12px] font-semibold text-zinc-300">
              💡 كيف أحصل على كود تفعيل؟
            </h3>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              أكواد التفعيل يوزّعها مالك البوت. إذا لم يكن لديك كود، تواصل مع
              المسؤول للحصول على واحد.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span>ExpertBot Live — نظام تفعيل آمن</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .activation-grid-bg {
          background-image:
            linear-gradient(rgba(16, 185, 129, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.06) 1px, transparent 1px);
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
