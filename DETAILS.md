# Project Details

This file provides a high level overview of how the main pieces of the system fit together. It complements `AGENTS.md` with more context for future development.

## Components

### Node Worker (`src/`)
* **index.js** – Discord self‑bot that ingests messages from configured channels, uses Mistral (via the Python service) to analyse them and forwards trade signals to `TradeTracker`.
* **services/tradeTracker.js** – Handles all database writes for trades, messages and trader stats. It also calls the Robinhood service to execute or simulate orders.
* **services/robinhood.js** – Wrapper around the Robinhood API. Records price snapshots and provides quotes for trade execution.
* **services/robinhoodSimulator.js** – Simulation layer used when a channel is disabled. Generates price data and maintains virtual positions while still writing to the database.
* **web/server.js** – Express server that exposes REST endpoints and a WebSocket for real‑time updates used by the Web UI.
* **market calendar pipeline** – nightly job that fetches scheduled events like FOMC meetings and stores them in a `MarketCalendar` table. Events can be queried via `/api/market-calendar` for display in the dashboard.

### Python FastAPI Service (`api/`)
* **mistral_server.py** – Loads the Mistral LLM, parses messages and returns structured trade information. It also schedules channel analysis and market calendar updates.

## Data Flow
1. Discord messages are queued and analysed by the Python server.
2. If a trade signal is confirmed, `TradeTracker` records the trade in PostgreSQL and optionally places an order through Robinhood.
3. Execution stats and price snapshots are saved whether the trade is real or simulated.
4. Model prompts and responses are stored in the `ModelLog` table for later review.
5. The Web UI pulls aggregated statistics from the database and receives live trade updates via WebSocket.
6. Manual labels provide supervised data by allowing humans to categorise messages. Market updates summarise major news events so the dataset includes market context.

## Data Quality
Good data is vital for training models and making decisions. We should track issues that reduce quality, set clear standards for new contributions and consider appointing a data steward to review incoming records.

## Missing Pieces
* Several Prisma tables lacked write paths. `marketUpdate` and `manualLabel` records can be created through the Web UI API and recent work added persistence for `tradeSignal` and `channelConfig`.
* Webhook notifications contain minimal information compared to earlier versions of the project. Initial improvements now include expiration and profit/loss fields when available.
* Live price data is simulated for many operations, reducing accuracy of P&L metrics.
* A `MarketCalendar` table has been added along with a Python script (`api/market_calendar.py`) that fetches an ICS calendar and stores upcoming events. This script now runs nightly from the FastAPI server.
* A simple file logger has been introduced for Node (`src/utils/logger.js`) and Python (`api/utils/logger.py`) so both components write structured logs under `data/logs`.
* The Python virtual environment under `api/venv` is excluded from version control and recreated with `setup.sh` (or `setup.bat`).

These notes should help developers understand where features live and what areas still need attention.
