import { createServer } from 'http'
import { Server } from 'socket.io'

// ---------- Pair configuration ----------
interface PairConfig {
  pair: string
  base: number
  volatility: number
  decimals: number
}

const PAIRS: PairConfig[] = [
  { pair: 'EURUSD', base: 1.0850, volatility: 0.00008, decimals: 5 },
  { pair: 'GBPUSD', base: 1.2720, volatility: 0.00010, decimals: 5 },
  { pair: 'USDJPY', base: 151.30, volatility: 0.012, decimals: 3 },
  { pair: 'BTCUSD', base: 67250.0, volatility: 45.0, decimals: 1 },
  { pair: 'ETHUSD', base: 3480.0, volatility: 3.2, decimals: 2 },
  { pair: 'AUDUSD', base: 0.6580, volatility: 0.00009, decimals: 5 },
]

// ---------- Internal state ----------
interface PairState {
  price: number
  prevPrice: number
  changePct: number
  open: number          // day open (used for changePct)
  candleOpen: number    // rolling candle open
  high: number          // rolling candle high
  low: number           // rolling candle low
  candleStartTs: number // ms timestamp when current candle started
  momentum: number      // small drift factor for occasional momentum
}

const CANDLE_INTERVAL_MS = 5000
const TICK_INTERVAL_MS = 700

// Round a price to the configured number of decimals for the pair
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// Clamp price to +/- 5% of the base price and keep it positive
function clampPrice(price: number, base: number): number {
  const floor = base * 0.95
  const ceil = base * 1.05
  if (price < floor) return floor
  if (price > ceil) return ceil
  return price
}

// Build initial state for every pair
function initState(): Record<string, PairState> {
  const state: Record<string, PairState> = {}
  const now = Date.now()
  for (const cfg of PAIRS) {
    const startPrice = roundTo(cfg.base, cfg.decimals)
    state[cfg.pair] = {
      price: startPrice,
      prevPrice: startPrice,
      changePct: 0,
      open: startPrice,        // day open = starting price
      candleOpen: startPrice,  // rolling candle open
      high: startPrice,
      low: startPrice,
      candleStartTs: now,
      momentum: 0,
    }
  }
  return state
}

const state = initState()

// ---------- HTTP + socket.io server ----------
const httpServer = createServer((req, res) => {
  // Tiny health-check endpoint for curl / browser probes
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'market-service', port: 3003 }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy gateway relies on "/"
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------- Snapshot helper ----------
function buildSnapshot() {
  const pairs: Record<string, { price: number; prevPrice: number; changePct: number; decimals: number }> = {}
  for (const cfg of PAIRS) {
    const s = state[cfg.pair]
    pairs[cfg.pair] = {
      price: s.price,
      prevPrice: s.prevPrice,
      changePct: s.changePct,
      decimals: cfg.decimals,
    }
  }
  return { pairs }
}

// ---------- Connection handling ----------
io.on('connection', (socket) => {
  console.log(`[market-service] client connected: ${socket.id}`)

  // Send current state immediately
  socket.emit('snapshot', buildSnapshot())

  // Optional: client can request the list of configured pairs
  socket.on('get-pairs', () => {
    const list = PAIRS.map((p) => ({
      pair: p.pair,
      decimals: p.decimals,
      base: p.base,
      volatility: p.volatility,
    }))
    socket.emit('pairs', list)
  })

  socket.on('disconnect', (reason) => {
    console.log(`[market-service] client disconnected: ${socket.id} (${reason})`)
  })

  socket.on('error', (err) => {
    console.error(`[market-service] socket error (${socket.id}):`, err)
  })
})

// ---------- Price update loop ----------
function tickOnce() {
  const now = Date.now()

  for (const cfg of PAIRS) {
    const s = state[cfg.pair]

    // Random-walk step: (rand - 0.5) * 2 * vol gives a value in [-vol, +vol]
    const randStep = (Math.random() - 0.5) * 2 * cfg.volatility

    // Occasional momentum drift: with ~15% probability, nudge momentum;
    // otherwise let it decay toward zero so price doesn't run away.
    if (Math.random() < 0.15) {
      s.momentum = (Math.random() - 0.5) * 2 * cfg.volatility * 0.6
    } else {
      s.momentum *= 0.7
    }

    let nextPrice = s.price + randStep + s.momentum
    nextPrice = clampPrice(nextPrice, cfg.base)
    nextPrice = roundTo(nextPrice, cfg.decimals)

    // prevPrice = price before this tick
    s.prevPrice = s.price
    s.price = nextPrice

    // changePct vs day open
    s.changePct = Math.round(((s.price - s.open) / s.open) * 10000) / 100

    // Update rolling candle high/low (close == price implicitly)
    if (s.price > s.high) s.high = s.price
    if (s.price < s.low) s.low = s.price

    // Finalize candle if 5s elapsed since candleStartTs
    if (now - s.candleStartTs >= CANDLE_INTERVAL_MS) {
      const candle = {
        t: s.candleStartTs,
        o: s.candleOpen,
        h: s.high,
        l: s.low,
        c: s.price,
        decimals: cfg.decimals,
      }
      io.emit('candle', { pair: cfg.pair, candle })

      // Start a fresh candle
      s.candleOpen = s.price
      s.high = s.price
      s.low = s.price
      s.candleStartTs = now
    }

    // Emit tick to every client
    io.emit('tick', {
      pair: cfg.pair,
      price: s.price,
      prevPrice: s.prevPrice,
      changePct: s.changePct,
      decimals: cfg.decimals,
      time: now,
    })
  }
}

setInterval(tickOnce, TICK_INTERVAL_MS)

// ---------- Start ----------
const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Market service listening on :${PORT}`)
})

// ---------- Graceful shutdown ----------
function shutdown(signal: string) {
  console.log(`[market-service] received ${signal}, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
