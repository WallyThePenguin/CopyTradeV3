# Prisma Schema Usage

This document lists each model defined in `prisma/schema.prisma` and notes where it is used in the codebase. Models that are not currently written to have been flagged for follow-up work.

## Channel
Channels represent Discord channels being monitored. Records are created in `src/index.js` and verified on startup via `src/services/databaseInit.js`. Channel performance metrics are updated in `TradeTracker.updateChannelPerformance`.

## Trade
Core table storing every trade signal. Trades are created and updated in `src/services/tradeTracker.js` and the Robinhood services. The Web UI queries this table for statistics and recent trades.

## Message
Logged messages from Discord. Added in `TradeTracker.trackMessage` and used to derive trader statistics in `getMessageCountsOverTime` within `src/web/server.js`.

## PriceSnapshot
Used by `src/services/robinhood.js` and `src/services/robinhoodSimulator.js` to record quotes. Exposed via `/api/price-snapshots`.

## MarketUpdate
Table for summarised market posts. Entries can now be created via `POST /api/market-updates` in `src/web/server.js` and are returned by `/api/market-updates`.

## MarketCalendar
Planned table for scheduled market events such as FOMC meetings or earnings season. The data will come from a free calendar API or a scraper of the Federal Reserve schedule. No code writes to this table yet.

## ModelLog
Stores each analysis prompt and response from the Mistral server. Entries are now created in `trackMessage` when a message is processed.

## ManualLabel
Holds human annotations for messages. Labels can be created with `POST /api/manual-labels` and fetched via `/api/manual-labels`.

## TradeSignal
Represents detected trade signals. Entries are now created in `TradeTracker.logTradeSignal` whenever a message produces a valid trade. Signals can be listed via `/api/signals`.

## ExecutionStats
Execution details for trades. Records are created and updated in `TradeTracker.trackTrade`, `TradeTracker.updateTrade` and the simulator.

## PerformanceHistory
Historical channel stats created in `updateChannelPerformance` and read by the stats API.

## ChannelConfig
Stores channel settings separately from the core `Channel` model. Configs can be created or updated with `POST /api/channel-config` and fetched via `/api/channel-config/:id`.

## MarketCalendar
New table storing scheduled economic events. Events are populated by running `api/market_calendar.py` which parses an ICS calendar feed.

## TraderStats
Aggregated statistics for each trader within a channel. Updated in `TradeTracker.updateTraderStats` and fetched by the stats API.

## BotStats
Overall bot performance metrics. Populated on-demand in `/api/bot-stats` when the endpoint is called.

## Data Quality Considerations
Every table should store accurate, complete information. Log data issues and define validation rules so future analytics are reliable. A dedicated steward can help enforce these standards.

