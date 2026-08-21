// indicators.ts — Technical analysis helpers (ported from Python indicators.py)
// All functions operate on arrays of candle closes (or full candles).

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** Simple Moving Average over the last `period` values of `arr`. Returns null if not enough data. */
export function sma(values: number[], period: number): number | null {
  if (!values || values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/** SMA that shifts forward by `offset` bars (so the value at position n uses data from n-offset-period..n-offset). */
export function smaShifted(values: number[], period: number, offset: number): number | null {
  if (!values || values.length < period + offset) return null;
  let sum = 0;
  const start = values.length - offset - period;
  for (let i = start; i < start + period; i++) sum += values[i];
  return sum / period;
}

/**
 * Alligator indicator (Bill Williams).
 *   jaw   = SMA(13) shifted -8 (future)
 *   teeth = SMA(8)  shifted -5
 *   lips  = SMA(5)  shifted -3
 *
 * Returns the three lines or nulls when not enough data.
 */
export function alligator(values: number[]): {
  jaw: number | null;
  teeth: number | null;
  lips: number | null;
} {
  return {
    jaw: smaShifted(values, 13, 8),
    teeth: smaShifted(values, 8, 5),
    lips: smaShifted(values, 5, 3),
  };
}

/**
 * Determine whether the alligator lines are properly ordered (lips > teeth > jaw)
 * — i.e. mouth "open" upward.
 */
export function alligatorOrdering(values: number[]): boolean | null {
  const a = alligator(values);
  if (a.jaw == null || a.teeth == null || a.lips == null) return null;
  return a.lips > a.teeth && a.teeth > a.jaw;
}

/** Wilder's RSI (period default 14). Returns null if not enough data. */
export function rsi(values: number[], period: number = 14): number | null {
  if (!values || values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  // first averages
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  // walk forward
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * MACD-style signal: fast SMA crosses slow SMA.
 * Returns "call" when fast just crossed above slow, "put" when crossed below, null otherwise.
 */
export function maCross(values: number[], fast: number = 3, slow: number = 8): "call" | "put" | null {
  if (!values || values.length < slow + 1) return null;
  const fastNow = sma(values, fast);
  const slowNow = sma(values, slow);
  const fastPrev = sma(values.slice(0, -1), fast);
  const slowPrev = sma(values.slice(0, -1), slow);
  if (fastNow == null || slowNow == null || fastPrev == null || slowPrev == null) return null;
  const crossedUp = fastPrev <= slowPrev && fastNow > slowNow;
  const crossedDown = fastPrev >= slowPrev && fastNow < slowNow;
  if (crossedUp) return "call";
  if (crossedDown) return "put";
  return null;
}

/**
 * Simple trend signal based on last N candle closes.
 * If >=4 of last 5 are green (c > o) → "call".
 * If >=4 of last 5 are red (c < o) → "put".
 * Else null.
 */
export function trendSignal(candles: Candle[], lookback: number = 5): "call" | "put" | null {
  if (!candles || candles.length < lookback) return null;
  const slice = candles.slice(-lookback);
  let green = 0;
  let red = 0;
  for (const c of slice) {
    if (c.c > c.o) green++;
    else if (c.c < c.o) red++;
  }
  if (green >= lookback - 1) return "call";
  if (red >= lookback - 1) return "put";
  return null;
}

/**
 * Alligator flip signal:
 *   prev ordering was false (or null) and now true → "call"
 *   prev ordering was true (or null) and now false → "put"
 */
export function alligatorFlip(values: number[]): "call" | "put" | null {
  if (!values || values.length < 22) return null;
  const prev = alligatorOrdering(values.slice(0, -1));
  const last = alligatorOrdering(values);
  if (prev == null || last == null) return null;
  if (!prev && last) return "call";
  if (prev && !last) return "put";
  return null;
}

/** Convenience: extract close prices from candle array. */
export function closes(candles: Candle[]): number[] {
  return (candles || []).map((c) => c.c);
}
