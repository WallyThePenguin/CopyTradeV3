# Project Details

This file provides a high level overview of how the main pieces of the system fit together. It complements `AGENTS.md` with more context for future development.

## Components

### Node Worker (`src/`)
* **index.js** – Discord self‑bot that ingests messages from configured channels, uses Mistral (via the Python service) to analyse them and forwards trade signals to `TradeTracker`.
* **services/tradeTracker.js** – Handles all database writes for trades, messages and trader stats. It also calls the Robinhood service to execute or simulate orders.
* **services/robinhood.js** – Wrapper around the Robinhood API. Records price snapshots and provides quotes for trade execution.
* **services/robinhoodSimulator.js** – Simulation layer used when a channel is disabled. Generates price data and maintains virtual positions while still writing to the database.
* **web/server.js** – Express server that exposes REST endpoints and a WebSocket for real‑time updates used by the Web UI.

### Python FastAPI Service (`api/`)
* **mistral_server.py** – Loads the Mistral LLM, parses messages and returns structured trade information. It can also analyse channels on a schedule, though output is currently only sent to the console.

## Data Flow
1. Discord messages are queued and analysed by the Python server.
2. If a trade signal is confirmed, `TradeTracker` records the trade in PostgreSQL and optionally places an order through Robinhood.
3. Execution stats and price snapshots are saved whether the trade is real or simulated.
4. The Web UI pulls aggregated statistics from the database and receives live trade updates via WebSocket.

## Missing Pieces
* Several Prisma tables (see `SCHEMA_DETAILS.md`) are read but never written to. Implementing those write paths would improve the dataset.
* Webhook notifications contain minimal information compared to earlier versions of the project.
* Live price data is simulated for many operations, reducing accuracy of P&L metrics.

These notes should help developers understand where features live and what areas still need attention.
