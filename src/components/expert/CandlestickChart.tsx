"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart as ChartIcon } from "lucide-react";

import {
  EMPTY_CANDLES,
  formatPrice,
  useExpertStore,
} from "@/lib/expert-store";
import type { Candle } from "@/lib/expert-types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

interface ViewBox {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

interface Scale {
  min: number;
  max: number;
  xStep: number;
  candleWidth: number;
}

function computeScale(candles: Candle[], vb: ViewBox): Scale {
  if (!candles.length) {
    return { min: 0, max: 1, xStep: 0, candleWidth: 0 };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.l < min) min = c.l;
    if (c.h > max) max = c.h;
  }
  // Add 5% padding top/bottom for breathing room.
  const pad = (max - min) * 0.08 || max * 0.001 || 1;
  min -= pad;
  max += pad;

  const innerW = vb.width - vb.padding.left - vb.padding.right;
  const n = candles.length;
  const xStep = n > 1 ? innerW / n : innerW;
  // Candle body width: 65% of slot, min 2px.
  const candleWidth = Math.max(2, Math.min(14, xStep * 0.65));
  return { min, max, xStep, candleWidth };
}

function yFor(price: number, scale: Scale, vb: ViewBox): number {
  const innerH = vb.height - vb.padding.top - vb.padding.bottom;
  if (scale.max === scale.min) return vb.padding.top + innerH / 2;
  const ratio = (price - scale.min) / (scale.max - scale.min);
  // SVG y grows downward, so invert.
  return vb.padding.top + innerH * (1 - ratio);
}

function xFor(i: number, scale: Scale, vb: ViewBox): number {
  return vb.padding.left + scale.xStep * (i + 0.5);
}

// Choose "nice" tick step for the price axis.
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.0001; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function priceDecimals(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return 2;
  if (range < 0.0001) return 6;
  if (range < 0.001) return 5;
  if (range < 0.01) return 4;
  if (range < 1) return 3;
  return 2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VB: ViewBox = {
  width: 800,
  height: 360,
  padding: { top: 12, right: 70, bottom: 22, left: 8 },
};

export default function CandlestickChart() {
  const candlesRaw = useExpertStore((s) => s.candles) ?? EMPTY_CANDLES;
  const currentPrice = useExpertStore((s) => s.currentPrice);
  const selectedAssetId = useExpertStore((s) => s.selectedAssetId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 800, h: 360 });

  // Responsive sizing via ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(320, e.contentRect.width);
        const h = Math.max(220, e.contentRect.height);
        setDims({ w, h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const candles: Candle[] = candlesRaw ?? EMPTY_CANDLES;

  const vb: ViewBox = useMemo(
    () => ({ ...VB, width: dims.w, height: dims.h }),
    [dims]
  );

  const scale = useMemo(() => computeScale(candles, vb), [candles, vb]);
  const ticks = useMemo(
    () => (candles.length ? niceTicks(scale.min, scale.max, 6) : []),
    [scale.min, scale.max, candles.length]
  );
  const decimals = useMemo(
    () => priceDecimals(scale.min, scale.max),
    [scale.min, scale.max]
  );

  const priceLineY = currentPrice != null ? yFor(currentPrice, scale, vb) : null;

  // Time gridlines (every ~10 candles)
  const timeMarkers = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    if (!candles.length) return out;
    const step = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += step) {
      const c = candles[i];
      const d = new Date(c.t * 1000);
      const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      out.push({ x: xFor(i, scale, vb), label });
    }
    return out;
  }, [candles, scale, vb]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ChartIcon className="size-3.5 text-emerald-400" />
          <span>الرسم البياني — Asset #{selectedAssetId}</span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">
          {candles.length} شمعة
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 min-h-[260px] overflow-hidden rounded-lg border border-white/10 bg-[#070b11]"
      >
        <svg
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="none"
          className="block"
        >
          {/* Horizontal gridlines + price axis */}
          {ticks.map((t, i) => {
            const y = yFor(t, scale, vb);
            return (
              <g key={`h-${i}`}>
                <line
                  x1={vb.padding.left}
                  x2={dims.w - vb.padding.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="2 4"
                />
                <text
                  x={dims.w - vb.padding.right + 4}
                  y={y + 3}
                  fill="rgba(255,255,255,0.45)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatPrice(t, decimals)}
                </text>
              </g>
            );
          })}

          {/* Vertical time markers */}
          {timeMarkers.map((m, i) => (
            <g key={`v-${i}`}>
              <line
                x1={m.x}
                x2={m.x}
                y1={vb.padding.top}
                y2={dims.h - vb.padding.bottom}
                stroke="rgba(255,255,255,0.04)"
              />
              <text
                x={m.x}
                y={dims.h - vb.padding.bottom + 14}
                fill="rgba(255,255,255,0.4)"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Candles */}
          {candles.map((c, i) => {
            const x = xFor(i, scale, vb);
            const yO = yFor(c.o, scale, vb);
            const yC = yFor(c.c, scale, vb);
            const yH = yFor(c.h, scale, vb);
            const yL = yFor(c.l, scale, vb);
            const up = c.c >= c.o;
            const color = up ? "#10b981" : "#ef4444";
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1, Math.abs(yC - yO));
            const halfW = scale.candleWidth / 2;
            return (
              <g key={`c-${c.t}-${i}`}>
                {/* Wick */}
                <line
                  x1={x}
                  x2={x}
                  y1={yH}
                  y2={yL}
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.9}
                />
                {/* Body */}
                <rect
                  x={x - halfW}
                  y={bodyTop}
                  width={scale.candleWidth}
                  height={bodyH}
                  fill={up ? color : color}
                  opacity={up ? 0.95 : 0.95}
                  rx={0.5}
                />
              </g>
            );
          })}

          {/* Live price line */}
          {priceLineY != null && (
            <g>
              <line
                x1={vb.padding.left}
                x2={dims.w - vb.padding.right}
                y1={priceLineY}
                y2={priceLineY}
                stroke="#fbbf24"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.9}
              />
              <rect
                x={dims.w - vb.padding.right + 1}
                y={priceLineY - 8}
                width={vb.padding.right - 2}
                height={16}
                fill="#fbbf24"
                rx={2}
              />
              <text
                x={dims.w - vb.padding.right + 4}
                y={priceLineY + 3}
                fill="#0a0e14"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="700"
              >
                {formatPrice(currentPrice ?? 0, decimals)}
              </text>
            </g>
          )}

          {/* Empty state */}
          {candles.length === 0 && (
            <text
              x={dims.w / 2}
              y={dims.h / 2}
              fill="rgba(255,255,255,0.3)"
              fontSize="13"
              fontFamily="monospace"
              textAnchor="middle"
            >
              بانتظار بيانات الشموع...
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
