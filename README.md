# CopyTradeV2: AI-Powered Trading Message Analysis

CopyTradeV2 ingests Discord trading chatter, classifies intent with a local Mistral 7B model, and auto-records callouts, trades, and performance telemetry via a hardened HTTPS gateway plus a React dashboard.

## Architecture Snapshot
- **Discord Worker & HTTPS Gateway (Node.js)**: `src/index.js` captures Discord messages (and can ingest other text feeds like X, Slack, or broker webhooks with minor adapters), hot-reloads channel configs, pushes analysis requests to the Python service, records callouts, opens/closes trades, and exposes REST/WebSocket APIs behind `helmet`, CORS allowlists, TLS certs, and API/admin-key guards.
- **ML/Analysis Service (Python/FastAPI)**: `api/mistral_server.py` loads GGUF weights through `llama-cpp-python`, keeps a rolling trade context, refreshes market calendar/news, and raises webhooks for downstream automation.
- **Trading & Brokerage Layer**: `tradingService`, `robinhood.js`, and `robinhoodSimulator.js` provide live vs simulated execution, quote lookups, price snapshots, and execution/audit logging while persisting via Prisma.
- **Dashboard + WebSockets**: React + Vite (`src/web`) renders channel, trader, callout, and performance views fed by `ws` broadcasts from the Node worker.
- **Data Plane**: Prisma over SQLite (`prisma/data/dev.db`) with migrations in `prisma/migrations/` covering channels, trades, callouts, execution stats, trader/bot metrics, job logs, and snapshots.
- **Security & Ops**: `start-secure-server.js` launches HTTPS with local certs, `express-rate-limit` throttles requests, cron jobs in `src/web/cron.js` run data-quality/perf checks, and audit/job logs are written through Prisma.

## Platform Status (Nov 2025)
- **Live**:
  - TLS-enabled Express gateway + WebSocket bridge serving the React dashboard from `dist/`.
  - Discord ingestion -> Mistral analysis -> Callout + TradeTracker persistence with price snapshots and execution stats.
  - Prisma migrations + seed coverage for SQLite, including TraderStats/BotStats, callout matches, and audit logging.
  - Cron-driven monitoring (data quality, hourly performance) and market calendar/news updaters.
  - Robinhood integration with token/device management, live vs sim execution toggles, and cached quotes/orders.
- **Still outstanding**:
  - Documenting how to refresh/replace the on-disk GGUF weights for the FastAPI service.
  - Automated smoke tests that exercise Discord ingestion through trade persistence against a fresh database.
  - Fine-grained rate limiting / benching for private and admin endpoints (current scope of the upcoming enhancement).

## Feature Highlights
- **Signal + Callout Intelligence**: Discord queues protect short/long-form channels, but the ingestion layer is source-agnostic—any textual feed (X, Slack, broker webhooks) can be normalized and pushed through Mistral and `CalloutService`, with entry/exit matches capturing bid/ask/mark snapshots for every callout.
- **Trading Automation & Risk Tracking**: `TradeTracker` normalizes entries/exits, links trades to callouts, updates execution stats, calculates PnL, and refreshes TraderStats/BotStats for dashboard use.
- **Monitoring & UX**: WebSocket broadcasts power live tables/charts for trades, callouts, traders, and market updates; audit logs and market feeds back the React dashboard and admin APIs.
- **Security & Ops Toolkit**: API/admin keys, request authentication for write routes, `helmet` + strict CORS origin list, rate limiting, rotating HTTPS cert launcher, cron health checks, and structured logging (`src/utils/logger.js`).

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   pip install -r api/requirements.txt
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   # Fill in DISCORD_TOKEN, ROBINHOOD_* creds, API_KEY, ADMIN_KEY, ADMIN_PASSWORD,
   # DATABASE_URL="file:./prisma/data/dev.db", USE_LIVE_MARKET_DATA, etc.
   ```
3. **Prepare the database (SQLite)**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate   # applies prisma/migrations/* into prisma/data/dev.db
   # optional: npx prisma db seed (see prisma/seed.js)
   ```
4. **Run the services**
   ```bash
   # Terminal 1 - FastAPI + Mistral
   cd api && uvicorn mistral_server:app --host 0.0.0.0 --port 8000

   # Terminal 2 - Discord worker + HTTPS gateway + dashboard assets
   npm run start-secure    # uses server.cert/server.key and enables WebSockets

   # Optional Terminal 3 - React dashboard in dev mode
   npm run web-dev
   ```
   Use `npm run start-http` for a plain HTTP launch or `npm run dev` if you prefer nodemon with the HTTP server while iterating.

## Service Commands
| Command | Purpose |
| --- | --- |
| `npm run prisma:generate` | Rebuild Prisma Client after schema changes. |
| `npm run prisma:migrate` | Apply migrations in `prisma/migrations/` to SQLite. |
| `npm run prisma:studio` | Browse/manage the SQLite db via Prisma Studio. |
| `npm run start-secure` | Launch HTTPS Express + WebSocket server with TLS. |
| `npm run start-http` | Start the HTTP version (`start-http-server.js`) for local debugging. |
| `npm run dev` | Nodemon HTTP dev loop plus certificate repair helper. |
| `npm run quality` | Execute Node-based data-quality checks (`src/utils/dataQuality.js`). |
| `uvicorn mistral_server:app ...` | Start the FastAPI/LLM service. |
| `npm run web-dev` / `npm run web-build` | Vite dev server / production build for the dashboard. |
| `npm run fix-cert` | Regenerate the local TLS bundle before running `start-secure`. |
| `npm run robinhood:login` / `npm run robinhood:account` | Manage broker auth tokens or inspect live account state. |

## API Surface (current)
| Endpoint | Notes |
| --- | --- |
| `GET /api/stats` (API key) | Aggregate trade counts, win rate, profit, active channels. |
| `GET /api/callouts`, `GET /api/callouts/:id`, `POST /api/callouts` (API key) | List, inspect, or manually create callouts with match history and price snapshots. |
| `GET /api/channels`, `GET /api/channels/:id`, `PATCH /api/channels/:id/mode`, `PATCH /api/channels/:id/auto-copy` | Query/adjust channel config, execution mode, or auto-copy flag. |
| `GET /api/trades`, `GET /api/trades/feed` | Paginated trade history and lightweight feeds for the dashboard. |
| `GET /api/trader-stats`, `GET /api/users`, `GET /api/users/:id/stats` | Surface TraderStats plus recent trades/leaderboards for UI cards. |
| `GET /api/charts/pl|winrate|volume|assets` | Pre-baked chart datasets for profits, win rate, trade volume, and asset mix. |
| `GET /api/market-updates` | Latest market calendar/news payloads refreshed by cron jobs. |
| `GET /api/bot-stats`, `GET /api/advanced-metrics`, `GET /api/trader-advanced-metrics/:id` | Higher-level performance + risk analytics powering the dashboard KPI widgets. |
| `GET /api/order-records` | Snapshotted broker order history synced by `tradingService`. |

The dashboard consumes these routes plus WebSocket events (`trade_opened`, `trade_closed`, `trade_signal`, `metrics_update`, etc.) from `src/web/broadcast.js`.

## Documentation & Roadmap
- `docs/SYSTEM_OVERVIEW.md` - Authoritative architecture, component interactions, and operational runbooks.
- `docs/PROJECT_STRUCTURE.md` - Folder-by-folder responsibilities across the Discord bot, middleware, and dashboard.
- `docs/LLM_MODEL_MAINTENANCE.md` - Step-by-step guide for refreshing/validating the on-disk Mistral GGUF weights.
- `docs/ROADMAP.md` - Phase planning, completed efforts, and upcoming rate-limit/rule-set work.

## Next Steps
1. Implement trader categorization/trust scores in Prisma (extend `TraderStats` or add `TraderRules`) plus a nightly job that updates category + request budgets.
2. Add a Redis-backed enforcement layer (`ensureTraderAllowed`) that tracks per-trader and per-category budgets for private/auth endpoints and powers benching.
3. Build queue/scheduling helpers so short-term traders spill into delay queues while swing traders receive priority execution when budgets are exhausted.
4. Document GGUF refresh steps and wire automated smoke tests once the new rate-limit layer lands.
