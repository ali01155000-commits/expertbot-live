"use client"

import * as React from "react"
import { io, type Socket } from "socket.io-client"
import { useBotStore } from "@/lib/bot-store"
import type { PairState, Candle } from "@/lib/bot-types"

// Connects to the market-data socket.io mini-service on port 3003
// via the Caddy gateway using XTransformPort query param.
export function MarketSocket() {
  const setPairs = useBotStore((s) => s.setPairs)
  const updatePair = useBotStore((s) => s.updatePair)
  const pushCandle = useBotStore((s) => s.pushCandle)
  const addLog = useBotStore((s) => s.addLog)
  const connected = useBotStore((s) => s.connected)
  const setConnected = useBotStore((s) => s.setConnected)

  React.useEffect(() => {
    if (!connected) return

    const sock: Socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    })

    sock.on("connect", () => {
      addLog({ type: "info", message: "🔌 تم الاتصال بخدمة بيانات السوق" })
    })

    sock.on("snapshot", (data: { pairs: Record<string, PairState> }) => {
      if (data?.pairs) setPairs(data.pairs)
    })

    sock.on("tick", (t: PairState & { pair: string }) => {
      if (!t?.pair) return
      updatePair(t.pair, {
        price: t.price,
        prevPrice: t.prevPrice,
        changePct: t.changePct,
        decimals: t.decimals,
      })
    })

    sock.on("candle", (msg: { pair: string; candle: Candle }) => {
      if (!msg?.pair || !msg?.candle) return
      pushCandle(msg.pair, msg.candle)
    })

    sock.on("disconnect", () => {
      addLog({ type: "warn", message: "انقطع الاتصال بخدمة السوق، إعادة المحاولة…" })
    })

    return () => {
      sock.disconnect()
    }
  }, [connected, setPairs, updatePair, pushCandle, addLog])

  return null
}
