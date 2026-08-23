"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  CandlestickChart,
  CheckCircle2,
  ListOrdered,
  Play,
  Settings,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useExpertStore } from "@/lib/expert-store";

const GUIDE_SEEN_KEY = "expertbot.guideSeen";

export default function BotUsageGuide() {
  const [step, setStep] = useState(0);

  const close = () => {
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {}
    useExpertStore.getState().setGuideSeen(true);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else close();
  };

  const steps = [
    {
      icon: Bot,
      title: "مرحباً بك في ExpertBot Live!",
      desc: "بوت تداول آلي يتصل بـ Expert Option. سأشرح لك كيف تستخدمه في 5 خطوات بسيطة.",
      color: "emerald",
    },
    {
      icon: Settings,
      title: "١. اختر إعدادات البوت",
      desc: "في تبويب «البوت»: اختر الإستراتيجية (متابعة الاتجاه، RSI، تقاطع المتوسطات، أو Alligator)، قيمة الرهان (مثلاً 10$)، مدة الصفقة (15-300 ثانية).",
      color: "violet",
    },
    {
      icon: Play,
      title: "٢. شغّل البوت",
      desc: "اضغط الزر الأخضر الكبير «▶ تشغيل البوت». سيبدأ البوت بتحليل السوق آلياً. عند ظهور إشارة، سينفّذ صفقة Buy أو Sell تلقائياً على Expert Option.",
      color: "emerald",
    },
    {
      icon: TrendingUp,
      title: "٣. تداول يدوي (اختياري)",
      desc: "في تبويب «تداول»: استخدم زرّي «▲ شراء CALL» (رهان على الصعود) أو «▼ بيع PUT» (رهان على الهبوط) للتداول اليدوي السريع.",
      color: "amber",
    },
    {
      icon: ListOrdered,
      title: "٤. راقب صفقاتك",
      desc: "تبويب «الصفقات»: الصفقات المفتوحة بعدّاد تنازلي. تبويب «السجل»: الصفقات المغلقة + سجل النشاط الملوّن. ستظهر الأرباح والخسائر فوراً.",
      color: "sky",
    },
    {
      icon: CheckCircle2,
      title: "٥. جاهز! استمتع بالتداول",
      desc: "هذا كل شيء! البوت يعمل 24/7. يمكنك إيقافه في أي وقت بضغط زر «■ إيقاف البوت». ابدأ دائماً بالحساب التجريبي للتعود على البوت.",
      color: "emerald",
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e14] p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={close}
          className="absolute left-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition"
        >
          <X className="size-5" />
        </button>

        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-emerald-400" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`flex size-20 items-center justify-center rounded-2xl bg-${current.color}-500/10 ring-2 ring-${current.color}-500/30`}
          >
            <Icon className={`size-10 text-${current.color}-400`} />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-center text-xl font-bold text-zinc-100">
          {current.title}
        </h2>

        {/* Description */}
        <p className="mb-6 text-center text-sm leading-relaxed text-zinc-400">
          {current.desc}
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              onClick={() => setStep(step - 1)}
              variant="outline"
              className="flex-1 gap-1.5 border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
              السابق
            </Button>
          )}
          <Button
            onClick={next}
            className="flex-1 gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="size-4" />
                ابدأ التداول
              </>
            ) : (
              "التالي"
            )}
          </Button>
        </div>

        {/* Skip link */}
        {!isLast && (
          <button
            onClick={close}
            className="mt-3 block w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            تخطّي الشرح
          </button>
        )}
      </div>
    </div>
  );
}
