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
Table for summarised market posts. Only queried by `/api/market-updates`; no inserts detected in the current code.

## ModelLog
Stores each analysis prompt and response from the Mistral server. Entries are now created in `trackMessage` when a message is processed.

## ManualLabel
Holds human annotations for messages. Rows are returned by an API endpoint but creation logic has not been implemented yet.

## TradeSignal
Represents detected trade signals. The schema defines a relation to `Trade` but the application does not currently create `TradeSignal` entries. Signals are only broadcast to WebSocket clients.

## ExecutionStats
Execution details for trades. Records are created and updated in `TradeTracker.trackTrade`, `TradeTracker.updateTrade` and the simulator.

## PerformanceHistory
Historical channel stats created in `updateChannelPerformance` and read by the stats API.

## ChannelConfig
Stores channel settings separately from the core `Channel` model. An API endpoint returns configs, but there is no code writing new rows.

## TraderStats
Aggregated statistics for each trader within a channel. Updated in `TradeTracker.updateTraderStats` and fetched by the stats API.

## BotStats
Overall bot performance metrics. Populated on-demand in `/api/bot-stats` when the endpoint is called.

