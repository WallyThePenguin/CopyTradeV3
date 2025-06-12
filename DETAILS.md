# Project Details

This file provides a high level overview of how the main pieces of the system fit together. It complements `AGENTS.md` with more context for future development.

## Components

### Node Worker (`src/`)
* **index.js** – Discord self‑bot that ingests messages from configured channels, uses Mistral (via the Python service) to analyse them and forwards trade signals to `TradeTracker`.
* **services/tradeTracker.js** – Handles all database writes for trades, messages and trader stats. It also calls the Robinhood service to execute or simulate orders.
* **services/robinhood.js** – Wrapper around the Robinhood API. Records price snapshots and provides quotes for trade execution. Quotes are also used by `mistral.js` to check stoploss and take‑profit levels. The service now exposes an `initialize()` method so other modules can ensure a session is available, automatically re‑logs when sessions expire and includes a `getHistoricalPrices` helper to retrieve recent candles.
* **services/robinhoodSimulator.js** – Simulation layer used when a channel is disabled. Generates price data and maintains virtual positions while still writing to the database. A helper `getPositions()` method exposes the current simulated holdings.
* **web/server.js** – Express server that exposes REST endpoints and a WebSocket for real‑time updates used by the Web UI. The server now initializes the trading service on startup so Robinhood sessions are ready. A `/api/positions` route returns open positions from the active trading service, `/api/order-history` lists recent orders and `/api/historical-prices` fetches candle data. Order history responses are persisted in an `OrderRecord` table which is exposed via `/api/order-records`. The web UI shows these holdings in a new table.
* **Authentication** – POST routes honor an `X-API-KEY` header when `API_KEY` is defined in the environment. This secures market updates, manual labels and channel configuration.
* **market calendar pipeline** – nightly job that fetches scheduled events like FOMC meetings and stores them in a `MarketCalendar` table. Events can be queried via `/api/market-calendar` for display in the dashboard.
* **market news importer** – a script `api/market_news.py` runs nightly to ingest headlines from a JSON feed into the `MarketUpdate` table. A companion endpoint `/api/refresh-market-news` can invoke this importer manually.

### Python FastAPI Service (`api/`)
* **mistral_server.py** – Loads the Mistral LLM, parses messages and returns structured trade information. It now reads environment variables from `.env` automatically and schedules channel analysis, market calendar updates and the nightly news importer.

## Data Flow
1. Discord messages are queued and analysed by the Python server.
2. If a trade signal is confirmed, `TradeTracker` records the trade in PostgreSQL and optionally places an order through Robinhood.
3. Execution stats and price snapshots are saved whether the trade is real or simulated.
4. Model prompts and responses are stored in the `ModelLog` table for later review.
5. The Web UI pulls aggregated statistics from the database and receives live trade updates via WebSocket.
6. Manual labels provide supervised data by allowing humans to categorise messages. Market updates summarise major news events so the dataset includes market context.
7. The channel analyzer updates per-channel settings nightly and now saves a summary row to `PerformanceHistory` for later review.

## Data Quality
Good data is vital for training models and making decisions. We should track issues that reduce quality, set clear standards for new contributions and consider appointing a data steward to review incoming records.
Run `npm run quality` to generate a report of trades or messages with missing values. The script now flags invalid statuses and zero quantities in addition to missing prices and option types so issues can be fixed quickly.
The same checks are available via the `/api/data-quality` endpoint so results can be viewed from the dashboard.
A cron task in `web/server.js` now runs this check daily and logs the output.

## Missing Pieces
* Several Prisma tables lacked write paths. `marketUpdate` and `manualLabel` records can be created through the Web UI API and recent work added persistence for `tradeSignal` and `channelConfig`.
* Webhook notifications contain minimal information compared to earlier versions of the project. Initial improvements now include expiration and profit/loss fields when available.
* Live price data was simulated for many operations, reducing accuracy of P&L metrics. A historical price endpoint now retrieves recent candles from Robinhood but deeper history is still missing.
* A `MarketCalendar` table has been added along with a Python script (`api/market_calendar.py`) that fetches an ICS calendar and stores upcoming events. This script now runs nightly from the FastAPI server.
* A simple file logger has been introduced for Node (`src/utils/logger.js`) and Python (`api/utils/logger.py`) so both components write structured logs under `data/logs`.
* Old log files are now removed automatically after 30 days when the Node server starts.
* The Python virtual environment under `api/venv` is excluded from version control and recreated with `setup.sh` (or `setup.bat`).
* Secrets are no longer committed. Use `.env.example` as a template for your own `.env` file which should remain untracked. The template now lists `API_KEY`, `WEB_PORT` and `NEWS_FEED_PATH` variables.
* Channel lists can now be filtered by mode (`/api/channels?mode=TEST|PROD`), and a new `/api/trades` endpoint exposes recent trades with the same filters. The Web UI reloads channels when the mode changes so simulated and production views stay separate.

These notes should help developers understand where features live and what areas still need attention.
