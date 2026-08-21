"use client";

import {
  Bot,
  ChevronDown,
  CircleDollarSign,
  LogOut,
  Radio,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatPrice,
  getExpertSocket,
  useExpertStore,
} from "@/lib/expert-store";
import { REGIONS } from "@/lib/expert-types";

export default function DashboardHeader() {
  const connected = useExpertStore((s) => s.connected);
  const profile = useExpertStore((s) => s.profile);
  const botRunning = useExpertStore((s) => s.botRunning);
  const regionKey = useExpertStore((s) => s.region);

  const balance = profile?.balance ?? 0;
  const currency = profile?.currency ?? "USD";
  const isDemo = profile?.isDemo ?? true;
  const name = profile?.name;
  const region = regionKey ? REGIONS[regionKey] : null;

  const handleDisconnect = () => {
    // Prevent auto-connect from immediately refiring after an explicit logout.
    try {
      sessionStorage.setItem("expertbot.skipAuto", "1");
    } catch {}
    const socket = getExpertSocket();
    socket?.emit("expert:disconnect");
    useExpertStore.getState().reset();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e14]/90 backdrop-blur-xl">
      <div className="flex h-12 lg:h-14 items-center justify-between gap-2 px-3 lg:px-4">
        {/* Logo + compact status */}
        <div className="flex items-center gap-2">
          <div className="flex size-8 lg:size-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Bot className="size-4 lg:size-5 text-emerald-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs lg:text-sm font-bold">
              Expert<span className="text-emerald-400">Bot</span>
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`size-1.5 rounded-full ${
                  connected
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                    : "bg-red-400 animate-pulse"
                }`}
              />
              <span className="text-[9px] lg:text-[10px] text-zinc-500">
                {connected ? "متصل" : "غير متصل"}
              </span>
              <span
                className={`ml-1 rounded px-1 text-[9px] ${
                  isDemo
                    ? "bg-sky-500/15 text-sky-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {isDemo ? "تجريبي" : "حقيقي"}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop status indicators */}
        <div className="hidden md:flex items-center gap-2">
          {/* Bot status */}
          <Badge
            variant="outline"
            className={`gap-1 ${
              botRunning
                ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                : "border-white/10 bg-white/[0.03] text-zinc-400"
            }`}
          >
            <Radio className={`size-3 ${botRunning ? "animate-pulse" : ""}`} />
            {botRunning ? "البوت يعمل" : "البوت متوقف"}
          </Badge>

          {/* Balance */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <Wallet className="size-3.5 text-emerald-400" />
            <span className="text-[11px] text-zinc-400">الرصيد</span>
            <span className="font-mono text-xs font-semibold text-zinc-100">
              {formatPrice(balance, 2)} {currency}
            </span>
          </div>
        </div>

        {/* Mobile balance (compact) */}
        <div className="flex md:hidden items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5">
          <Wallet className="size-3 text-emerald-400" />
          <span className="font-mono text-[11px] font-semibold text-emerald-300">
            {formatPrice(balance, 0)}
          </span>
        </div>

        {/* Account dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-1.5 px-1.5 lg:px-2 hover:bg-white/5"
              size="sm"
            >
              <Avatar className="size-7 ring-1 ring-white/10">
                <AvatarFallback className="bg-emerald-500/15 text-[11px] font-bold text-emerald-300">
                  {name ? name.charAt(0).toUpperCase() : "EO"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-3.5 text-zinc-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 bg-[#0a0e14] border-white/10 text-zinc-100"
          >
            <DropdownMenuLabel className="text-zinc-400 text-xs">
              معلومات الحساب
            </DropdownMenuLabel>
            <div className="px-2 py-2 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <CircleDollarSign className="size-3.5" />
                  الرصيد
                </span>
                <span className="font-mono text-emerald-300">
                  {formatPrice(balance, 2)} {currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">النوع</span>
                <span className={isDemo ? "text-sky-300" : "text-red-300"}>
                  {isDemo ? "تجريبي" : "حقيقي"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">الاتصال</span>
                <span className={connected ? "text-emerald-300" : "text-red-300"}>
                  {connected ? "متصل بـ Expert Option" : "غير متصل"}
                </span>
              </div>
              {region && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">المنطقة</span>
                  <span className="text-zinc-300 text-[11px]">
                    {region.flag} {region.labelAr}
                  </span>
                </div>
              )}
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleDisconnect}
              className="cursor-pointer text-red-300 hover:text-red-200 focus:bg-red-500/10 focus:text-red-200"
            >
              <LogOut className="size-4" />
              قطع الاتصال
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
