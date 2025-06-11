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

## Areas for Improvement

- **Price Retrieval** – real entry and exit prices were simulated. A basic integration now pulls quotes from Robinhood for stoploss checks, but full price history is still needed.
- **Webhook Details** – webhook embeds should show symbol, strike, expiration and trader so notifications are clearer. *Initial improvements added expiration and P&L fields.*
 - **Authentication & Security** – API POST routes now accept an `X-API-KEY` header when `API_KEY` is set. This provides a minimal layer of protection.
- **UI Polishing** – the dashboard occasionally shows incorrect P&L and the period buttons still have quirks.  Trader statistics could also highlight which channel executed a trade.
- **Error Logging** – a unified logging strategy across Node and Python would improve troubleshooting. *Node now uses a simple logger but Python still relies on the standard library.*
- **Repository Size** – the included Python virtual environment inflates the repo; a setup script may be preferable. *`api/venv` is now ignored and `setup.sh` (or `setup.bat`) recreates it on demand.*
- **Market Calendar** – create a table to store scheduled economic events (e.g. FOMC meetings) by parsing a public calendar like the Federal Reserve's or an equivalent API.  Insert these dates into SQL so the UI can display upcoming market events.
- **Market Update Sources** – find a reliable API or broker feed to automatically populate the `MarketUpdate` table with news headlines or summaries. *Initial implementation added `api/market_news.py` which imports a JSON feed nightly.*
- **Data Quality** – document and monitor problems that lead to bad data. Bad data increases cost and hurts decision making. Establish collection standards and assign a data steward to perform regular checks.
  A helper script (`npm run quality`) now checks the database for missing or invalid fields to aid this review.

## Completion Status

The foundation for automated trade tracking is in place: Discord ingestion, LLM analysis, trading/simulation and a basic dashboard. Model logging, manual labels and market updates are persisted, and trade signals plus channel configs now write to the database. Basic API key auth protects write routes, but initial price retrieval via Robinhood has been added, though full history and some UI bugs remain unresolved. Overall progress feels around **82% complete** toward a production‑ready tool.
