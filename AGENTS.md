# Project Overview

This project combines a Node.js worker and a Python FastAPI service to automatically parse trading callouts from Discord and log every action into a PostgreSQL database via Prisma.  Detected trades are optionally executed through Robinhood or simulated when a channel is disabled.  A Web UI served from `src/web` exposes statistics and recent activity with real-time updates over WebSockets.  Recent work added POST endpoints for manual labels and market updates so additional tables are populated.

## Short‑Term Goal

The short term goal is to reliably mirror trades from selected Discord channels, track their execution, and surface performance metrics so channels can be marked **enabled** or **disabled** for real trading.

## Long‑Term Vision

All messages, trades and market events will be collected from roughly fifty traders over the course of a year.  This rich dataset will later be used to train an algorithm that can evaluate and potentially automate trade ideas.

## Current Features

- **Discord Monitoring** – `src/index.js` watches configured channels and feeds messages to the Mistral LLM for intent detection.
- **LLM Message Analysis** – `api/mistral_server.py` confirms trade signals and extracts details through prompt engineering.
- **Trade Execution & Tracking** – `src/services/tradeTracker.js` records each trade, captures execution stats, and updates channel/trader performance.  Trades include an optional `author` field.
- **Simulated vs Production Modes** – channels flagged as disabled still record trades but do not place real orders.
- **Statistics API** – `/api/stats` aggregates trade, channel and trader metrics.  Additional routes expose market updates, manual labels, model logs, price snapshots, channel configs and bot stats.  Manual labels and market updates also support POST requests for data entry.
- **Web UI Dashboard** – `src/web/public` displays performance cards, charts and recent trades.  WebSocket signals keep the UI in sync.
- **Channel Selector** – the dashboard can filter statistics by channel and toggle between **Simulated** and **Production** modes.
- **Filtered Channel Lists** – `/api/channels` accepts a `mode` query so only enabled or disabled channels appear depending on the selected view.
- **Webhook Notifications** – trade events are posted to Discord webhooks and the embeds now include symbol, strike, expiration, trader and P&L when available.
- **Model Logging** – each LLM analysis is stored in the `ModelLog` table so prompts and responses can be reviewed later.
- **Trade Signal Logging** – each confirmed signal now creates a `TradeSignal` row so the dataset reflects every alert.
- **Channel Configuration API** – `/api/channel-config` allows saving per-channel settings to the `ChannelConfig` table.
- **Market Calendar Endpoint** – `/api/market-calendar` lists upcoming economic events stored by `api/market_calendar.py`. The calendar is refreshed nightly.
- **Scheduled Maintenance** – the Python service runs channel analysis and market calendar updates every day.
- **Performance History Storage** – when channel configs are updated the analyzer now logs summarized metrics to the `PerformanceHistory` table.
- **Trading Service Initialization** – the Robinhood service exposes an `initialize()` method so simulators and live trading share the same startup flow. The web server now initializes the trading service on startup and `TradeTracker` calls it before executing orders.
- **Positions Endpoint** – `/api/positions` now returns open positions from the active trading service so the dashboard can display current holdings.
- **Order History Endpoint** – `/api/order-history` exposes recent account orders retrieved from the trading service.
- **Order Record Storage** – responses from `/api/order-history` are now persisted to an `OrderRecord` table and can be listed via `/api/order-records`.
- **Open Positions Table** – the dashboard now includes a table that lists current holdings using data from the positions endpoint.
- **Data Quality Endpoint** – `/api/data-quality` returns any issues found by the quality checker so admins can monitor database health.
- **Trade Mode Tracking** – trades now include a `mode` field indicating whether they were executed in `PRODUCTION` or `SIMULATED` mode based on the environment and channel settings.
- **CALL/PUT Normalization** – messages like `SPY 591 CALL` are standardized before analysis so the model parses them correctly.
- **Simulator Initialization Fix** – the Robinhood simulator only initializes once, preventing repeated "Initializing" logs.
- **Scheduled Quality Checks** – a cron task runs the data quality script daily and logs the results to `data/logs`.
- **Automatic Log Cleanup** – the Node logger now deletes log files older than 30 days during startup.
- **Historical Price Endpoint** – `/api/historical-prices` retrieves recent market data from Robinhood for improved price accuracy.
- **Environment Loader** – `mistral_server.py` automatically loads environment variables from `.env` so the Python service runs without manual exports.
- **Configurable Confidence Threshold** – regex exit detection uses `CONFIDENCE_THRESHOLD` from `.env` so tolerances can be tuned without code changes.
- **Mistral Backend Guide** – detailed documentation for the Python server now lives in `mistral_backend.md`.
- **Extended `.env` Template** – `.env.example` now includes `API_KEY`, `NEWS_FEED_PATH` and `WEB_PORT` settings for easier configuration.
- **Trader Stats Fix** – statistics queries now filter by channel status through the relation instead of an `enabled` field. This resolves the `Unknown argument` Prisma error when loading trader stats.
- **Signal Query Fix** – `getSignalQuality` now filters through the `trade.channel` relation so Prisma accepts the query when counting signals by mode.
- **Session Auto-Refresh** – `robinhood.js` now attempts to re-login when its session is invalid, reducing trade errors.
- **Environment Validation** – Node services run a `validateEnv` check on startup and exit if required variables like `DISCORD_TOKEN` or `DATABASE_URL` are missing.

## Areas for Improvement

- **Price Retrieval** – real entry and exit prices were simulated. Quotes are now pulled from Robinhood for stoploss checks and a `/api/historical-prices` endpoint provides recent candles, but comprehensive history is still needed.
- **Webhook Details** – webhook embeds should show symbol, strike, expiration and trader so notifications are clearer. *Initial improvements added expiration and P&L fields.*
 - **Authentication & Security** – API POST routes now accept an `X-API-KEY` header when `API_KEY` is set. This provides a minimal layer of protection.
- **UI Polishing** – the dashboard occasionally shows incorrect P&L and the period buttons still have quirks.  Trader statistics could also highlight which channel executed a trade.
- **Error Logging** – a unified logging strategy across Node and Python would improve troubleshooting. *Node now uses a simple logger but Python still relies on the standard library.*
- **Repository Size** – the included Python virtual environment inflates the repo; a setup script may be preferable. *`api/venv` is now ignored and `setup.sh` (or `setup.bat`) recreates it on demand.*
- **Environment Files** – secrets were accidentally committed. A template `.env.example` now provides sample variables and `.env` is git‑ignored. Copy the example to configure your own credentials.
- **Market Calendar** – create a table to store scheduled economic events (e.g. FOMC meetings) by parsing a public calendar like the Federal Reserve's or an equivalent API.  Insert these dates into SQL so the UI can display upcoming market events.
- **Market Update Sources** – find a reliable API or broker feed to automatically populate the `MarketUpdate` table with news headlines or summaries. *Initial implementation added `api/market_news.py` which imports a JSON feed nightly.*
  - A new `/api/refresh-market-news` endpoint can trigger this importer on demand so the dashboard stays current between scheduled runs.
- **Data Quality** – document and monitor problems that lead to bad data. Bad data increases cost and hurts decision making. Establish collection standards and assign a data steward to perform regular checks.
  A helper script (`npm run quality`) now checks for missing prices, invalid option types, bad statuses and zero quantities to aid this review.
  Results are logged automatically each day via the new cron job.

## Completion Status

The foundation for automated trade tracking is in place: Discord ingestion, LLM analysis, trading/simulation and a basic dashboard. Model logging, manual labels and market updates are persisted, and trade signals plus channel configs now write to the database. Basic API key auth protects write routes, initial price retrieval via Robinhood is available and positions can be queried via the new endpoint. With these additions the project feels around **85% complete** toward a production‑ready tool.
