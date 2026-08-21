"use client"

import * as React from "react"
import { useBotStore, formatPrice } from "@/lib/bot-store"
import { PAIR_META, type Candle } from "@/lib/bot-types"

const EMPTY_CANDLES: Candle[] = []

export function CandlestickChart() {
  const pair = useBotStore((s) => s.selectedPair)
  const candles = useBotStore((s) => s.candles[pair] ?? EMPTY_CANDLES)
  const pairState = useBotStore((s) => s.pairs[pair])
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(800)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(320, e.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = 380
  const padL = 8
  const padR = 72
  const padT = 14
  const padB = 22

  const meta = PAIR_META[pair]
  const decimals = meta?.decimals ?? 5
  const data = candles.slice(-60)
  const currentPrice = pairState?.price ?? data[data.length - 1]?.c ?? 0

  const allVals = data.flatMap((c) => [c.h, c.l])
  if (currentPrice) allVals.push(currentPrice)
  const min = allVals.length ? Math.min(...allVals) : 0
  const max = allVals.length ? Math.max(...allVals) : 1
  const range = max - min || 1
  const pad = range * 0.12
  const yMin = min - pad
  const yMax = max + pad
  const yRange = yMax - yMin || 1

  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const slot = plotW / Math.max(data.length, 1)
  const bodyW = Math.max(2, Math.min(14, slot * 0.62))

  const x = (i: number) => padL + i * slot + slot / 2
  const y = (v: number) => padT + (1 - (v - yMin) / yRange) * plotH

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const v = yMin + (yRange * i) / 4
    return { v, y: y(v) }
  })

  const upColor = "#22c55e"
  const downColor = "#ef4444"

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={height}
        className="block"
        style={{ background: "transparent" }}
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={g.y}
              y2={g.y}
              stroke="currentColor"
              className="text-white/5"
              strokeDasharray="2 4"
            />
            <text
              x={padL + plotW + 6}
              y={g.y + 3}
              fontSize="10"
              className="fill-muted-foreground"
              fontFamily="monospace"
            >
              {formatPrice(g.v, decimals)}
            </text>
          </g>
        ))}

        {data.map((c, i) => {
          const isUp = c.c >= c.o
          const color = isUp ? upColor : downColor
          const yO = y(c.o)
          const yC = y(c.c)
          const yH = y(c.h)
          const yL = y(c.l)
          const top = Math.min(yO, yC)
          const h = Math.max(1, Math.abs(yC - yO))
          return (
            <g key={c.t}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={yH}
                y2={yL}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x(i) - bodyW / 2}
                y={top}
                width={bodyW}
                height={h}
                fill={color}
                opacity={0.92}
                rx={1}
              />
            </g>
          )
        })}

        {currentPrice > 0 && (
          <g>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={y(currentPrice)}
              y2={y(currentPrice)}
              stroke="#eab308"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <rect
              x={padL + plotW}
              y={y(currentPrice) - 9}
              width={padR}
              height={18}
              fill="#eab308"
              rx={3}
            />
            <text
              x={padL + plotW + 5}
              y={y(currentPrice) + 4}
              fontSize="11"
              fontWeight="700"
              fill="#1a1a1a"
              fontFamily="monospace"
            >
              {formatPrice(currentPrice, decimals)}
            </text>
          </g>
        )}

        {data.length === 0 && (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fontSize="13"
            className="fill-muted-foreground"
          >
            في انتظار بيانات السوق…
          </text>
        )}
      </svg>
    </div>
  )
}
