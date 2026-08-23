"use client";

import {
  Bot,
  ChevronDown,
  CircleDollarSign,
  Link2,
  LogOut,
  QrCode,
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

        {/* === Invite link button (visible in topbar) === */}
        <button
          onClick={async () => {
            const token = localStorage.getItem("expertbot.token");
            if (!token) return;
            const url = window.location.origin + "/?token=" + token;
            navigator.clipboard?.writeText(url);
            const qr = await import("qrcode").then((m) => m.default);
            const qrUrl = await qr.toDataURL(url, {
              width: 300,
              margin: 2,
              color: { dark: "#0a0e14", light: "#10b981" },
            });
            const w = window.open("", "_blank", "width=420,height=560");
            if (w) {
              w.document.write(`
                <html dir="rtl"><head><title>رابط المشاركة</title>
                <style>
                  body{font-family:system-ui;background:#0a0e14;color:#fff;text-align:center;padding:24px;margin:0}
                  h2{color:#10b981;margin:0 0 16px}
                  img{border:4px solid #10b981;border-radius:12px;margin:8px 0}
                  p{color:#999;font-size:13px;margin:8px 0}
                  code{background:#1a1a2e;padding:10px 14px;border-radius:8px;color:#10b981;display:block;margin:12px;word-break:break-all;font-size:11px;direction:ltr}
                  .ok{color:#10b981;font-weight:bold;margin-top:8px}
                </style></head><body>
                  <h2>رابط مشاركة ExpertBot</h2>
                  <img src="${qrUrl}" width="260" height="260" />
                  <p>امسح الـ QR بكاميرا الآيفون أو أرسل الرابط:</p>
                  <code>${url}</code>
                  <p class="ok">تم نسخ الرابط ✅</p>
                  <p style="font-size:11px;color:#555">العميل يفتح الرابط → البوت يعمل فوراً</p>
                </body></html>
              `);
              w.document.close();
            }
          }}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
          title="إنشاء رابط مشاركة + QR Code"
        >
          <Link2 className="size-3.5" />
          <span className="hidden sm:inline">رابط مشاركة</span>
          <QrCode className="size-3.5 sm:hidden" />
        </button>

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
              onClick={async () => {
                const token = localStorage.getItem("expertbot.token");
                if (!token) return;
                const url = window.location.origin + "/?token=" + token;
                // Copy URL
                navigator.clipboard?.writeText(url);
                // Also generate QR code and show in a new window
                const qr = await import("qrcode").then((m) => m.default);
                const qrUrl = await qr.toDataURL(url, {
                  width: 300,
                  margin: 2,
                  color: { dark: "#0a0e14", light: "#10b981" },
                });
                const w = window.open("", "_blank", "width=400,height=520");
                if (w) {
                  w.document.write(`
                    <html dir="rtl"><head><title>رابط الدعوة</title>
                    <style>body{font-family:system-ui;background:#0a0e14;color:#fff;text-align:center;padding:20px}
                    h2{color:#10b981}img{border:4px solid #10b981;border-radius:12px}
                    p{color:#999;font-size:14px;margin-top:10px}
                    code{background:#222;padding:8px 12px;border-radius:6px;color:#10b981;display:block;margin:10px;word-break:break-all;font-size:11px}
                    </style></head><body>
                    <h2>رابط دعوة ExpertBot</h2>
                    <img src="${qrUrl}" width="250" height="250" />
                    <p>امسح الـ QR بآيفون أو أرسل الرابط:</p>
                    <code>${url}</code>
                    <p style="color:#10b981">تم نسخ الرابط ✅</p>
                    </body></html>
                  `);
                  w.document.close();
                } else {
                  alert("تم نسخ رابط الدعوة!\n\n" + url);
                }
              }}
              className="cursor-pointer text-emerald-300 hover:text-emerald-200 focus:bg-emerald-500/10 focus:text-emerald-200"
            >
              <Link2 className="size-4" />
              إنشاء رابط دعوة + QR Code
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={handleDisconnect}
              className="cursor-pointer text-red-300 hover:text-red-200 focus:bg-red-500/10 focus:text-red-200"
            >
              <LogOut className="size-4" />
              قطع الاتصال
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                useExpertStore.getState().setActivated(false);
                useExpertStore.getState().setActivationCode(null);
                useExpertStore.getState().reset();
              }}
              className="cursor-pointer text-amber-300 hover:text-amber-200 focus:bg-amber-500/10 focus:text-amber-200"
            >
              <LogOut className="size-4" />
              إلغاء التفعيل (خروج نهائي)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
