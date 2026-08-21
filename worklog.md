# ExpertBot Pro — Worklog

This file is the shared worklog for all agents working on the ExpertBot Pro
automated trading bot simulator (Next.js 16 + Prisma + socket.io).

**Project goal:** Build a simulated automated trading bot platform where the
user enters an account, the "platform" opens, and a bot trades automatically on
simulated live market data.

**IMPORTANT CONTEXT for all agents:**
- This is a SIMULATION/DEMO. No real money, no real exchange connection.
- Market data is simulated by a socket.io mini-service.
- Trades are settled against the simulated price feed.
- UI is in Arabic (RTL) and dark-themed (trading platform style).

**Architecture:**
- Frontend: `src/app/page.tsx` (single route) + components in `src/components/bot/`
- State: Zustand store in `src/lib/bot-store.ts`
- API routes: `src/app/api/account/*`, `src/app/api/trade/*`, `src/app/api/bot/*`
- Realtime: socket.io mini-service at `mini-services/market-service/` on port **3003**
- DB: Prisma + SQLite. Schema already pushed (Account, Trade, BotConfig).

**Market service contract (port 3003, socket.io path "/"):**
- Emits `snapshot` on connect: `{ pairs: { EURUSD: {price, prevPrice, changePct}, ... } }`
- Emits `tick` every ~700ms: `{ pair, price, time }`
- Emits `candle` every 5s: `{ pair, candle: {t, o, h, l, c} }` (aggregated OHLC)
- Pairs: EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, AUDUSD
- Frontend connects with: `io("/?XTransformPort=3003")`

**API contract (all return JSON):**
- `POST /api/account/login` body `{email, platformToken, accountType}` → `{account, token}`
- `GET /api/account/[id]` → `{account}`
- `POST /api/trade/execute` body `{accountId, pair, direction, amount, expirySec, source, strategy}` → `{trade}`
- `POST /api/trade/settle` body `{tradeId, exitPrice}` → `{trade, won}`
- `GET /api/trade/open/[accountId]` → `{trades:[]}`
- `GET /api/trade/history/[accountId]?limit=50` → `{trades:[]}`
- `POST /api/bot/config` body `{accountId, ...config, active}` → `{config}`
- `GET /api/bot/config/[accountId]` → `{config|null}`

**Payout rule:** win = amount * 0.85 profit; loss = -amount; tie = 0.

---
Task ID: 1
Agent: orchestrator (main)
Task: Set up Prisma schema + db push + initialize worklog

Work Log:
- Inspected existing Next.js 16 project (shadcn/ui, recharts, zustand, prisma available)
- Wrote `prisma/schema.prisma` with Account, Trade, BotConfig models
- Ran `bun run db:push` to apply schema to SQLite
- Created this shared worklog at `/home/z/my-project/worklog.md`

Stage Summary:
- DB schema ready. Next: dispatch subagents for market-service (2-a) and API routes (2-b)
  in parallel, then build the frontend dashboard (3).

---
Task ID: 2-b
Agent: api-builder
Task: Build API routes for account, trade, bot config

Work Log:
- Read worklog + prisma schema + db.ts + tsconfig + eslint config to confirm conventions and that DB/models are already pushed.
- Created 8 Next.js 16 App Router route handlers under `src/app/api/`:
  * `account/login/route.ts` (POST, upsert by email, balance 10000 on create, returns `{account, token: id}`)
  * `account/[id]/route.ts` (GET, returns `{account}` incl. botConfigs, 404 if missing)
  * `trade/execute/route.ts` (POST, validates amount>0 / direction CALL|PUT / expirySec>=1 / entryPrice>0; `db.$transaction` deducts stake from balance and creates open trade; 400 on insufficient balance)
  * `trade/settle/route.ts` (POST, `db.$transaction`; CALL wins if exit>entry, PUT wins if exit<entry, tie if equal; payout = amount*1.85 win / amount tie / 0 loss; credits payout back to account on win/tie; sets exitPrice/payout/profit/closedAt; returns `{trade, won}`)
  * `trade/open/[accountId]/route.ts` (GET, list open trades ordered by openedAt desc)
  * `trade/history/[accountId]/route.ts` (GET, `?limit` query clamped 1..500 default 50; closed trades ordered by closedAt desc)
  * `bot/config/route.ts` (POST, upsert: findFirst by accountId, update or create; one config per account)
  * `bot/config/[accountId]/route.ts` (GET, returns `{config}` or `{config: null}`)
- All handlers use `NextRequest`, awaited `params` Promise pattern for Next.js 16 dynamic routes, `Response.json(...)` everywhere, and try/catch with 400 fallback.
- Trade execute + settle wrap balance mutations in `db.$transaction` so balance stays consistent with trade state.
- Ran `bun run lint` -> clean, no errors in any of the new files.

Stage Summary:
- API contract (matches worklog spec):
  * `POST /api/account/login` `{email, platformToken, accountType}` -> `{account, token}`
  * `GET  /api/account/[id]` -> `{account}` (404 if missing)
  * `POST /api/trade/execute` `{accountId, pair, direction, amount, expirySec, source, strategy, entryPrice}` -> `{trade}` (400 on insufficient balance)
  * `POST /api/trade/settle` `{tradeId, exitPrice}` -> `{trade, won:boolean}` (404 if not found, 400 if not open)
  * `GET  /api/trade/open/[accountId]` -> `{trades:[]}`
  * `GET  /api/trade/history/[accountId]?limit=50` -> `{trades:[]}`
  * `POST /api/bot/config` `{accountId, strategy, pair, amount, expirySec, martingale, mgMultiplier, maxTrades, active}` -> `{config}`
  * `GET  /api/bot/config/[accountId]` -> `{config | null}`
- Payout rule: win=amount*0.85 profit / payout amount*1.85; loss=-amount / 0; tie=0 / amount (stake returned).
- No test files written. No schema changes. Ready for frontend (task 3) to consume these routes.

---
Task ID: 2-a
Agent: market-service-builder
Task: Build market-data WebSocket mini-service on port 3003

Work Log:
- Read worklog.md to pick up conventions: socket.io path "/", port 3003, pairs EURUSD/GBPUSD/USDJPY/BTCUSD/ETHUSD/AUDUSD, frontend connects with `io("/?XTransformPort=3003")`.
- Reviewed `examples/websocket/server.ts` for the established Caddy-friendly server pattern (path "/", cors "*", pingTimeout 60000, pingInterval 25000).
- Created independent Bun + TypeScript project at `mini-services/market-service/`:
  * `package.json` — name `market-service`, type `module`, deps `socket.io`, devDeps `typescript` + `@types/node`, script `"dev": "bun --hot index.ts"`.
  * `tsconfig.json` — target ESNext, module ESNext, moduleResolution bundler, strict, types ["node"].
  * `index.ts` — the server (see spec below).
- Ran `bun install` — resolved 23 packages, lockfile saved.
- Implemented 6 trading pairs with base/volatility/decimals exactly per spec (EURUSD 1.0850/0.00008/5, GBPUSD 1.2720/0.00010/5, USDJPY 151.30/0.012/3, BTCUSD 67250.0/45.0/1, ETHUSD 3480.0/3.2/2, AUDUSD 0.6580/0.00009/5).
- In-memory per-pair state: `{ price, prevPrice, changePct, open (day open), candleOpen, high, low, candleStartTs, momentum }`.
- Price loop runs every 700ms: random-walk step `(Math.random()-0.5)*2*volatility` + a small decaying momentum drift (re-rolled with 15% probability, decays ×0.7 otherwise). Price clamped to ±5% of base and rounded to the pair's decimals. `prevPrice` set to the pre-tick price; `changePct` recomputed vs day open and rounded to 2 decimals. Rolling 5s candle high/low updated; when 5s elapse since `candleStartTs`, a `candle` event is emitted and a fresh candle starts (o=h=l=c=price). A `tick` event is emitted to all clients on every step.
- socket.io server config: `path: "/"`, `cors: { origin: "*", methods: ["GET","POST"] }`, `pingTimeout: 60000`, `pingInterval: 25000`, hardcoded port 3003. HTTP server also exposes a tiny `/health` route (note: with path "/", engine.io intercepts every URL prefix, so `/health` actually returns engine.io's `{"code":0,"message":"Transport unknown"}` — this is expected and harmless; it confirms the server is alive).
- On connection: emits `snapshot` immediately with `{ pairs: { PAIR: {price, prevPrice, changePct, decimals}, ... } }`, logs the connection, handles `disconnect`. Also handles a `get-pairs` client event and replies on the same socket with `pairs` = array of `{pair, decimals, base, volatility}`.
- Startup log line: `Market service listening on :3003`. Graceful shutdown on SIGTERM/SIGINT.
- Started the service. Initial attempts with plain `nohup ... &` and `setsid ... &` were reaped by the sandbox as soon as the launching bash command returned (verified: even `setsid bash -c 'sleep 3600' &; disown` was killed between bash invocations). Switched to `start-stop-daemon --background --make-pidfile` which properly orphans the process to PID 1 — the service now persists across bash calls exactly like the Next.js dev server (PID 1150) does. Pidfile: `/tmp/market-service.pid`. Logs: `/home/z/my-project/market-service.log`.
- Verified end-to-end with an inline socket.io-client probe (no test file written): `snapshot` received with all 6 pairs and correct decimals; `tick` events flowing (~30 ticks / 3s = 6 pairs × ~1.4 Hz, matching the 700ms interval); `candle` events emitted for all 6 pairs at the 5s boundary with correct `{t,o,h,l,c,decimals}` shape; `get-pairs` → `pairs` reply correct.

Stage Summary:
- Files created:
  * `/home/z/my-project/mini-services/market-service/package.json`
  * `/home/z/my-project/mini-services/market-service/tsconfig.json`
  * `/home/z/my-project/mini-services/market-service/index.ts`
  * `/home/z/my-project/mini-services/market-service/bun.lock` (generated)
- Port: **3003** (hardcoded). socket.io path: **"/"**.
- How to run (dev): `cd /home/z/my-project/mini-services/market-service && bun run dev`
- How it's currently running in this sandbox (persists across commands):
  `start-stop-daemon --start --background --make-pidfile --pidfile /tmp/market-service.pid --chdir /home/z/my-project/mini-services/market-service --exec /usr/bin/bun -- run dev`
  — or the spec form (works but is reaped when the launching shell exits in this sandbox):
  `cd /home/z/my-project/mini-services/market-service && nohup bun run dev > /home/z/my-project/market-service.log 2>&1 &`
- To stop: `start-stop-daemon --stop --pidfile /tmp/market-service.pid` (or `pkill -f "bun --hot index.ts"`).
- Events emitted by server: `snapshot` (on connect), `tick` (every 700ms per pair), `candle` (every 5s per pair), `pairs` (reply to client `get-pairs`).
- Event payload shapes (exact, verified):
  * `snapshot`: `{ pairs: { EURUSD: {price, prevPrice, changePct, decimals:5}, GBPUSD:{...5}, USDJPY:{...3}, BTCUSD:{...1}, ETHUSD:{...2}, AUDUSD:{...5} } }`
  * `tick`: `{ pair, price, prevPrice, changePct, decimals, time }`
  * `candle`: `{ pair, candle: { t, o, h, l, c, decimals } }`
  * `pairs`: `[{pair, decimals, base, volatility}, ...]`
- Frontend connects with: `io("/?XTransformPort=3003", { transports: ["websocket","polling"] })`.
- No test files written. Service is live and emitting; ready for the frontend (task 3) to consume.

---
Task ID: 3
Agent: orchestrator (main) — frontend builder
Task: Build the full frontend dashboard (login gate + trading platform + bot engine)

Work Log:
- Created `src/lib/bot-types.ts` (Account, Trade, BotConfig, PairState, Candle, LogEntry, PAIR_META, STRATEGY_META)
- Created `src/lib/bot-store.ts` (Zustand store: account, pairs, candles, openTrades, history, logs, bot config; helpers calcSMA/calcRSI/formatPrice)
- Created `src/lib/bot-api.ts` (fetch wrappers: login, executeTrade, settleTrade, openTrades, history, saveBotConfig, getBotConfig)
- Built components in `src/components/bot/`:
  - LoginScreen.tsx — account entry (email, platform token, demo/real), risk disclaimer, animated grid bg
  - DashboardHeader.tsx — logo, live pair ticker, balance, bot status badge, account dropdown + disconnect
  - StatsCards.tsx — balance, win rate, P&L, bot status (4 cards)
  - PairList.tsx — 6 pairs with live price + % change + active highlight
  - CandlestickChart.tsx — custom SVG candlestick chart (green/red), live price line, grid, responsive via ResizeObserver
  - BotControlPanel.tsx — strategy select, amount, expiry, martingale toggle+multiplier, maxTrades slider, Start/Stop bot, manual CALL/PUT buttons
  - OpenPositions.tsx — live open trades with countdown progress bar + winning/losing indicator
  - ActivityLog.tsx — scrolling monospace log with typed colors (info/signal/trade/win/loss/warn/error)
  - TradeHistory.tsx — closed trades table (pair, direction, source, amount, P&L, time)
  - MarketSocket.tsx — invisible component, connects socket.io to port 3003 via XTransformPort, feeds ticks+candles to store
  - BotEngine.tsx — the brain: evaluates ma_cross/rsi/trend/martingale strategies on each new candle, executes trades via API, settles expired trades on interval, handles martingale progression, loads open/history on connect
- Rewrote `src/app/page.tsx` — single route: LoginScreen gate → full dashboard (header + stats + 3-col layout: pairs | chart+bot+history | positions+logs) + sticky footer
- Updated `src/app/layout.tsx` — Arabic RTL (dir="rtl" lang="ar"), dark theme, Sonner toaster added

Fixes during verification:
- Fixed Zustand getSnapshot infinite-loop: `s.candles[pair] || []` returned a new array each render → replaced with module-level `EMPTY_CANDLES` constant in CandlestickChart + BotEngine
- Confirmed socket.io must connect through Caddy gateway (port 81) for XTransformPort routing; works correctly via gateway.

Stage Summary:
- Frontend complete and browser-verified end-to-end:
  - Login → platform opens → live prices stream (6 pairs, 700ms ticks, 5s candles)
  - Bot auto-trades: MA cross signal → auto trade execution → 30s settle → balance updates
  - Verified a real bot cycle in the activity log: signal SELL EURUSD @1.08641 → executed → settled LOSS -50$ → next signal BUY @1.08654
  - Balance went 10,000$ → 9,850$ across 3 trades (1 settled loss + stakes locked)
  - Mobile (390px) and desktop (1280px) both render correctly; sticky footer works; no console errors.

---
Task ID: 4
Agent: orchestrator (main) — integration & verification
Task: Wire realtime, lint, verify with agent-browser

Work Log:
- Installed socket.io-client
- Ran `bun run lint` → clean (0 errors, 0 warnings)
- All 3 services running: Next.js dev (:3000), market-service (:3003), Caddy gateway (:81)
- agent-browser verification through gateway http://localhost:81:
  1. Login screen renders (Arabic RTL, default creds prefilled)
  2. Click "الدخول وفتح المنصة" → platform boots → dashboard appears
  3. Live prices populate for all 6 pairs (socket connected, market-service log confirms client)
  4. Candlestick chart renders with live candles
  5. Clicked "تشغيل البوت" → bot started, controls disabled, "بوت نشط" badge
  6. After ~40s candles accumulated → bot emitted MA cross signal → auto-executed trade → settled after 30s → balance updated → next signal fired
  7. Mobile viewport 390x844 verified (single-column stack)
  8. Console clean (no errors)

Stage Summary:
- DONE. ExpertBot Pro is fully functional and browser-verified. The complete golden path
  (enter account → platform opens → bot trades automatically → trades settle → balance/history update)
  works end-to-end with simulated data.
