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
- **Webhook Notifications** – trade events are posted to Discord webhooks, though the embeds lack detailed fields.
- **Model Logging** – each LLM analysis is stored in the `ModelLog` table so prompts and responses can be reviewed later.

## Areas for Improvement

- **Price Retrieval** – real entry and exit prices are simulated.  Integrating a reliable price feed would make P&L and risk metrics accurate.
- **Webhook Details** – webhook embeds should show symbol, strike, expiration and trader so notifications are clearer.
- **Authentication & Security** – all endpoints are currently public.  Basic auth or token based access would protect the system.
- **UI Polishing** – the dashboard occasionally shows incorrect P&L and the period buttons still have quirks.  Trader statistics could also highlight which channel executed a trade.
- **Error Logging** – a unified logging strategy across Node and Python would improve troubleshooting.
- **Repository Size** – the included Python virtual environment inflates the repo; a setup script may be preferable.
- **Market Calendar** – create a table to store scheduled economic events (e.g. FOMC meetings) by parsing a public calendar like the Federal Reserve's or an equivalent API.  Insert these dates into SQL so the UI can display upcoming market events.
- **Market Update Sources** – find a reliable API or broker feed to automatically populate the `MarketUpdate` table with news headlines or summaries.
- **Data Quality** – document and monitor problems that lead to bad data. Bad data increases cost and hurts decision making. Establish collection standards and assign a data steward to perform regular checks.

## Completion Status

The foundation for automated trade tracking is in place: Discord ingestion, LLM analysis, trading/simulation and a basic dashboard.  Basic model logging has been added and manual labels/market updates are now persisted. Price data, security hardening and some UI bugs remain unresolved, so the project feels around **78% complete** towards a production‑ready tool.
