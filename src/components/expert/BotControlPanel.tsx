"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bot,
  Infinity as InfinityIcon,
  Pause,
  Play,
  Settings2,
  TrendingUp,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  formatPrice,
  getExpertSocket,
  useExpertStore,
} from "@/lib/expert-store";
import {
  STRATEGY_LIST,
  STRATEGY_META,
  type StrategyKey,
} from "@/lib/expert-types";

const EXPIRY_OPTIONS = [
  { value: 15, label: "15 ثانية" },
  { value: 30, label: "30 ثانية" },
  { value: 60, label: "60 ثانية" },
  { value: 120, label: "2 دقيقة" },
  { value: 300, label: "5 دقائق" },
];

export default function BotControlPanel() {
  const connected = useExpertStore((s) => s.connected);
  const botConfig = useExpertStore((s) => s.botConfig);
  const botRunning = useExpertStore((s) => s.botRunning);
  const botStats = useExpertStore((s) => s.botStats);
  const updateConfig = useExpertStore((s) => s.updateConfig);

  const strategyMeta = STRATEGY_META[botConfig.strategy];

  const handleStart = () => {
    if (!connected || botRunning) return;
    getExpertSocket()?.emit("bot:start", {
      strategy: botConfig.strategy,
      assetId: botConfig.assetId,
      amount: botConfig.amount,
      exptime: botConfig.exptime,
      isDemo: botConfig.isDemo,
      martingale: botConfig.martingale,
      mgMultiplier: botConfig.mgMultiplier,
      maxTrades: botConfig.maxTrades,
    });
  };

  const handleStop = () => {
    if (!botRunning) return;
    getExpertSocket()?.emit("bot:stop");
  };

  const handleManual = (direction: "call" | "put") => {
    if (!connected) return;
    getExpertSocket()?.emit("expert:manual-trade", {
      direction,
      amount: botConfig.amount,
      exptime: botConfig.exptime,
    });
  };

  return (
    <div className="space-y-4">
      {/* Strategy */}
      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs">
          <Settings2 className="size-3.5 text-emerald-400" />
          الاستراتيجية
        </Label>
        <Select
          value={botConfig.strategy}
          onValueChange={(v) => updateConfig({ strategy: v as StrategyKey })}
          disabled={botRunning}
        >
          <SelectTrigger className="w-full bg-black/40 border-white/10 text-zinc-100" disabled={botRunning}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0e14] border-white/10 text-zinc-100">
            {STRATEGY_LIST.map((s) => (
              <SelectItem
                key={s.key}
                value={s.key}
                className="focus:bg-emerald-500/10 focus:text-emerald-300"
              >
                {s.labelAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
          {strategyMeta?.descriptionAr}
        </p>
      </div>

      {/* Amount + Expiry */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs">المبلغ ($)</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={botConfig.amount}
            onChange={(e) => updateConfig({ amount: Math.max(1, Number(e.target.value) || 0) })}
            disabled={botRunning}
            className="bg-black/40 border-white/10 font-mono"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-xs">مدة الانتهاء</Label>
          <Select
            value={String(botConfig.exptime)}
            onValueChange={(v) => updateConfig({ exptime: Number(v) })}
            disabled={botRunning}
          >
            <SelectTrigger className="w-full bg-black/40 border-white/10 text-zinc-100" disabled={botRunning}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0e14] border-white/10 text-zinc-100">
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={String(o.value)}
                  className="focus:bg-emerald-500/10 focus:text-emerald-300"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Martingale */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-zinc-200 text-xs">مارتنغال (Martingale)</Label>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              ضاعف الرهان بعد كل خسارة لاسترجاع رأس المال
            </p>
          </div>
          <Switch
            checked={botConfig.martingale}
            onCheckedChange={(v) => updateConfig({ martingale: v })}
            disabled={botRunning}
          />
        </div>
        {botConfig.martingale && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">المضاعف</span>
              <span className="font-mono text-emerald-300">
                ×{botConfig.mgMultiplier.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[botConfig.mgMultiplier]}
              min={1.5}
              max={3}
              step={0.1}
              onValueChange={(v) => updateConfig({ mgMultiplier: v[0] })}
              disabled={botRunning}
            />
            <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
              <span>1.5×</span>
              <span>2.0×</span>
              <span>2.5×</span>
              <span>3.0×</span>
            </div>
          </div>
        )}
      </div>

      {/* Max trades */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <Label className="text-zinc-300 text-xs flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-400" />
            أقصى عدد صفقات
          </Label>
          <span className="font-mono text-emerald-300 flex items-center gap-1">
            {botConfig.maxTrades === 0 ? (
              <>
                <InfinityIcon className="size-3" />
                غير محدود
              </>
            ) : (
              botConfig.maxTrades
            )}
          </span>
        </div>
        <Slider
          value={[botConfig.maxTrades]}
          min={0}
          max={50}
          step={1}
          onValueChange={(v) => updateConfig({ maxTrades: v[0] })}
          disabled={botRunning}
        />
        <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
          <span>0 (لانهائي)</span>
          <span>25</span>
          <span>50</span>
        </div>
      </div>

      {/* Bot stats mini-display */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-center">
        <div>
          <div className="text-[10px] text-zinc-500">صفقات منفذة</div>
          <div className="font-mono text-sm font-bold text-zinc-100">
            {botStats.tradesPlaced}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">PnL البوت</div>
          <div
            className={`font-mono text-sm font-bold ${
              botStats.pnl > 0
                ? "text-emerald-400"
                : botStats.pnl < 0
                  ? "text-red-400"
                  : "text-zinc-100"
            }`}
          >
            {botStats.pnl >= 0 ? "+" : ""}
            {formatPrice(botStats.pnl, 2)}$
          </div>
        </div>
      </div>

      {/* Start/Stop */}
      <Button
        onClick={botRunning ? handleStop : handleStart}
        disabled={!connected || (botRunning && !connected)}
        className={`w-full h-11 font-bold ${
          botRunning
            ? "bg-red-500 hover:bg-red-400 text-white"
            : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_25px_-5px_rgba(16,185,129,0.6)]"
        }`}
      >
        {botRunning ? (
          <>
            <Pause className="size-4" />
            إيقاف البوت
          </>
        ) : (
          <>
            <Play className="size-4" />
            تشغيل البوت
          </>
        )}
      </Button>

      {/* Manual trade */}
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-[11px]">تداول يدوي سريع</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleManual("call")}
            disabled={!connected || botRunning}
            variant="outline"
            className="h-10 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
          >
            <ArrowUpCircle className="size-4" />
            شراء (Call)
          </Button>
          <Button
            onClick={() => handleManual("put")}
            disabled={!connected || botRunning}
            variant="outline"
            className="h-10 border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
          >
            <ArrowDownCircle className="size-4" />
            بيع (Put)
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600 flex items-center gap-1">
          <Bot className="size-3" />
          يُعطّل التداول اليدوي أثناء عمل البوت الآلي.
        </p>
      </div>
    </div>
  );
}
