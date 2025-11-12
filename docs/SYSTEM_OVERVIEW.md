# CopyTradeV2 System Overview

## Mission & Scope
CopyTradeV2 ingests Discord trading chatter, enriches it with on-device LLM analysis, and coordinates simulated or real executions through broker APIs. The platform must provide trustworthy callouts, verifiable execution data, and fast feedback loops for traders and admins while enforcing security boundaries on every private endpoint.

## Component Map
| Layer | Responsibilities | Key Services / Files |
| --- | --- | --- |
| Discord Worker & HTTPS Gateway | Discord ingestion, queueing, analysis dispatch, callout capture, trade orchestration, Express APIs, WebSockets. | `src/index.js`, `src/web/server.js`, `src/web/websocket.js`, `src/web/routes/api.js` |
| ML / Analysis Service | Runs FastAPI endpoints that wrap the local Mistral 7B GGUF model, keeps trade context, refreshes market data/news, emits webhooks. | `api/mistral_server.py`, `api/analysis/channel_analyzer.py`, `api/market_*` |
| Callout & Trade Tracking | Normalize Discord/manual callouts, attach price snapshots, create trades, compute execution stats, maintain TraderStats/BotStats. | `src/services/calloutService.js`, `src/services/tradeTracker.js`, `src/services/auditLogger.js` |
| Trading & Brokerage | Live vs simulated execution, quote retrieval, order/position sync, Robinhood auth/token lifecycle, simulator fallback. | `src/services/tradingService.js`, `src/services/robinhood.js`, `src/services/robinhoodSimulator.js` |
| Dashboard + WebSockets | React/Vite SPA served from `dist/`, receives `ws` broadcasts for trades/callouts/perf metrics, exposes admin workflows. | `src/web/*.tsx`, `src/web/broadcast.js`, `vite.config.js` |
| Data Plane | Prisma over SQLite (`prisma/data/dev.db`) with migrations for channels, trades, callouts, trader/bot stats, execution logs, job logs. | `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.js` |

## End-to-End Flow
1. Discord messages are ingested by `discord.js-selfbot-v13`, separated into short/long-form queues, and routed to the Python analysis service.
2. `mistral_server.py` classifies the message, returns structured trade metadata, updates ChannelAnalyzer metrics, and optionally fires a webhook.
3. `CalloutService` persists the parsed signal, captures the originating message, and snapshots bid/ask/mark data.
4. `TradeTracker` decides whether to auto-execute (live vs sim), opens or closes trades, records execution stats, links callouts, and broadcasts WebSocket events.
5. The HTTPS Express gateway (`src/web/server.js`) serves REST endpoints consumed by the React dashboard and authenticated automation, while `ws` broadcasts live updates.
6. Cron jobs (data quality, hourly performance, weekly cleanup) and market calendar/news workers keep background data fresh.

## Key Modules
- **Discord Ingestion & Channel Config**: `src/config/channels.js` defines monitored channels (type, risk, confidence, webhooks). Hot reloading via `chokidar` keeps the worker aligned with config and inserts/updates Prisma `Channel` rows on boot.
- **Analysis & Context**: The FastAPI service loads on-disk GGUF weights through `llama-cpp-python`, manages GPU memory, keeps a TradeContext for exits, and populates ChannelAnalyzer stats. Environment variables are read from `.env` at startup.
- **Callout + Trade Tracking**: `calloutService` records Discord/manual callouts, attaches price snapshots/matches, and updates statuses as trades fill or close. `tradeTracker` handles entry/exit logic, execution stats, TraderStats updates, and broadcast notifications.
- **Trading Service & Brokerage**: `tradingService` switches between Robinhood live execution and the simulator based on `ENVIRONMENT` / channel settings. `robinhood.js` manages OAuth/device tokens, quotes, historical data, and order/position sync while caching to Prisma.
- **Web/API Layer & Security**: The Express server is wrapped in TLS (`start-secure-server.js`), `helmet`, strict CORS allowlists, and `express-rate-limit`. API/admin keys guard write/admin routes (`authenticateWrite`, `authenticateAdmin`, `validateApiKey`). Errors are normalized via `src/utils/errors.js`.
- **Dashboard & WebSockets**: The React SPA (App/Dashboard/Channels/Users pages) consumes REST endpoints plus WebSocket events such as `trade_opened`, `trade_signal`, `metrics_update`, and `bot_stats_update`.
- **Market Data & Cron Jobs**: `api/market_calendar.py` and `api/market_news.py` populate market feeds; `src/web/cron.js` runs daily data-quality checks, hourly performance summaries, and weekly cleanup, broadcasting results via WebSockets.
- **Observability**: Structured logging lives in `src/utils/logger.js`, audit logs are stored via `ExecutionAuditLog`, `JobLog` tracks cron executions, and `src/utils/dataQuality.js` powers manual health checks.

## Data Model Highlights
- **Channel / Message**: Track Discord metadata, enabled state, min confidence, and parsed message bodies.
- **Callout / CalloutMatch / PriceSnapshot**: Capture raw analysis, trader attribution, bid/ask/mark snapshots, and entry/exit matches.
- **Trade / ExecutionStats / ExecutionAuditLog**: Store trade lifecycle, mode (SIMULATED vs PRODUCTION), performance stats, and raw broker responses.
- **TraderStats / BotStats**: Persist per-trader aggregates, leaderboards, and macro KPIs for dashboard widgets.
- **MarketUpdate / MarketNews / JobLog**: Feed dashboards with scheduled news/calendar data while surfacing job health.

## Security & Access Control
- HTTPS by default (`start-secure-server.js`) with local cert/key pairs and the option to fall back to HTTP in dev.
- API key required on mutating or sensitive endpoints; admin-only routes require `x-admin-key`/`x-admin-password`.
- `helmet`, curated CORS origin list, and `express-rate-limit` provide baseline protection.
- Request logging and audit tables offer traceability for every execution and admin action.

## Operations & Runbooks
- Environment setup: `.env` derived from `.env.example`, `DATABASE_URL="file:./prisma/data/dev.db"`, Discord/Robinhood/API key secrets defined per environment.
- Database: `npm run prisma:migrate` applies migrations, `npm run prisma:studio` inspects state, `prisma/seed.js` can populate reference data.
- Services: `uvicorn mistral_server:app` hosts the LLM API; `npm run start-secure` launches Express/WebSocket; `npm run web-dev` serves the SPA during development.
- Background jobs: Cron + FastAPI schedulers refresh market data, ChannelAnalyzer metrics, and data-quality stats; logs persist via `JobLog`.

## Known Gaps / Upcoming Work
- **Model maintenance**: Need documented steps for refreshing GGUF weights and validating GPU settings after swaps.
- **Rate limiting & trader benching**: Current protections rely on global Express throttles; per-trader/category budgets, bench states, and queueing via Redis are the next security priority.
- **Automated validation**: No end-to-end smoke/regression suite yet; Discord ingestion through trade persistence still requires manual verification.
- **Multi-broker readiness**: Only Robinhood + simulator paths exist; adapters for other brokers remain long-term roadmap items.
