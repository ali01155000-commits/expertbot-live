"use client"

import * as React from "react"
import { useBotStore } from "@/lib/bot-store"
import { apiLogin, apiGetBotConfig } from "@/lib/bot-api"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import {
  Bot,
  Mail,
  KeyRound,
  ShieldAlert,
  Loader2,
  Cpu,
  CandlestickChart,
  Zap,
} from "lucide-react"

export function LoginScreen() {
  const setAccount = useBotStore((s) => s.setAccount)
  const setConnecting = useBotStore((s) => s.setConnecting)
  const setConnected = useBotStore((s) => s.setConnected)
  const updateConfig = useBotStore((s) => s.updateConfig)
  const addLog = useBotStore((s) => s.addLog)

  const [email, setEmail] = React.useState("trader@expertbot.pro")
  const [token, setToken] = React.useState("EO-DEMO-9f3a2c1b")
  const [type, setType] = React.useState<"demo" | "real">("demo")
  const [loading, setLoading] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !token.trim()) {
      toast.error("يرجى إدخال البريد ورمز المنصة")
      return
    }
    setLoading(true)
    setConnecting(true)
    addLog({ type: "info", message: `بدء الاتصال بالمنصة بحساب ${email}` })
    try {
      const { account } = await apiLogin(email.trim(), token.trim(), type)
      setAccount(account)
      addLog({
        type: "info",
        message: `تم إنشاء/استرجاع الحساب ${account.email} | رصيد: ${account.balance}$`,
      })
      // load saved bot config if any
      try {
        const { config } = await apiGetBotConfig(account.id)
        if (config) updateConfig(config)
      } catch {
        /* ignore */
      }
      // small artificial "booting platform" delay for UX
      await new Promise((r) => setTimeout(r, 900))
      setConnected(true)
      addLog({ type: "info", message: "✓ تم فتح منصة التداول بنجاح" })
    } catch (err) {
      toast.error((err as Error).message)
      setConnecting(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0e14] px-4 py-10">
      {/* animated grid bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #22c55e 1px, transparent 1px), linear-gradient(to bottom, #22c55e 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />

      <div className="relative z-10 mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/30">
          <Bot className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            ExpertBot <span className="text-emerald-400">Pro</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            بوت تداول آلي ذكي · محاكاة كاملة
          </p>
        </div>
      </div>

      <Card className="relative z-10 w-full max-w-md border-white/10 bg-card/80 p-6 backdrop-blur">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">
              البريد الإلكتروني للحساب
            </Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/60 pr-9"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="token" className="text-xs text-muted-foreground">
              رمز منصة Expert Option
            </Label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="bg-background/60 pr-9 font-mono"
                placeholder="EO-XXXX-XXXX"
                disabled={loading}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              في النسخة الحقيقية يُجلب هذا الرمز من إعدادات حسابك في المنصة
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">نوع الحساب</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as "demo" | "real")}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="demo"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-background/40 px-3 py-2 text-sm has-[:checked]:border-emerald-500/60 has-[:checked]:bg-emerald-500/10"
              >
                <RadioGroupItem id="demo" value="demo" />
                <span>تجريبي (10,000$)</span>
              </Label>
              <Label
                htmlFor="real"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-background/40 px-3 py-2 text-sm has-[:checked]:border-yellow-500/60 has-[:checked]:bg-yellow-500/10"
              >
                <RadioGroupItem id="real" value="real" />
                <span>حقيقي</span>
              </Label>
            </RadioGroup>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ فتح المنصة…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                الدخول وفتح المنصة
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" /> بوت ذكي
            </span>
            <span className="flex items-center gap-1">
              <CandlestickChart className="h-3 w-3" /> رسوم حية
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> تنفيذ فوري
            </span>
          </div>
        </form>
      </Card>

      <div className="relative z-10 mt-6 max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            <strong>تنبيه:</strong> هذه أداة محاكاة تعليمية. التداول الآلي الحقيقي
            على منصات الخيارات الثنائية يحمل مخاطر مالية عالية وقد ينتهك شروط
            استخدام المنصة. لا تستخدم أموالاً حقيقية دون فهم المخاطر.
          </p>
        </div>
      </div>
    </div>
  )
}
