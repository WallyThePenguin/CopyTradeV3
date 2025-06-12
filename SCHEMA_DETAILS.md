# Prisma Schema Usage

This document lists each model defined in `prisma/schema.prisma` and notes where it is used in the codebase. Models that are not currently written to have been flagged for follow-up work.

## Channel
Channels represent Discord channels being monitored. Records are created in `src/index.js` and verified on startup via `src/services/databaseInit.js`. Channel performance metrics are updated in `TradeTracker.updateChannelPerformance`.

## Trade
Core table storing every trade signal. Trades are created and updated in `src/services/tradeTracker.js` and the Robinhood services. The Web UI queries this table for statistics and recent trades.
Each record stores an optional `author` so the dashboard can attribute trades to specific Discord users.
Trades include a `mode` field indicating whether they were executed in `PRODUCTION` or `SIMULATED` mode. They can be fetched via the `/api/trades` endpoint with optional `mode` and `channel` filters.

## Message
Logged messages from Discord. Added in `TradeTracker.trackMessage` and used to derive trader statistics in `getMessageCountsOverTime` within `src/web/server.js`.

## PriceSnapshot
Used by `src/services/robinhood.js` and `src/services/robinhoodSimulator.js` to record quotes. `mistral.js` pulls the latest quote when checking stoploss or take‑profit levels. Snapshots are exposed via `/api/price-snapshots`.
The trading service initializes on server startup and before each order so snapshot collection only begins once a valid broker session is available. Historical candles can be fetched via `/api/historical-prices` for ad-hoc analysis but are not stored in a dedicated table.

## MarketUpdate
Table for summarised market posts. Entries can be created via `POST /api/market-updates` and retrieved with `/api/market-updates`. A nightly task in `api/market_news.py` inserts headlines from a JSON feed. A helper endpoint `/api/refresh-market-news` can trigger this importer manually. The feed path can be a local file or a remote URL via the `NEWS_FEED_PATH` environment variable.

## MarketCalendar
Stores scheduled economic events such as FOMC meetings. Events are inserted by `api/market_calendar.update_market_calendar`, which runs nightly from the FastAPI service. Upcoming events can be retrieved with `GET /api/market-calendar`.

## Order History
Order information is pulled from the trading service via `/api/order-history`. Responses are now saved to an `OrderRecord` table. Saved records can be fetched with `/api/order-records`.

## OrderRecord
Stores individual broker orders. Entries are written when order history is requested. The Web API exposes these records via `/api/order-records` for audit purposes.

## Open Positions
Current holdings are fetched from the active trading service using `/api/positions`. No table exists for these records; the endpoint simply forwards whatever the broker returns so the dashboard can show live positions.

## ModelLog
Stores each analysis prompt and response from the Mistral server. Entries are now created in `trackMessage` when a message is processed.

## ManualLabel
Holds human annotations for messages. Labels can be created with `POST /api/manual-labels` and fetched via `/api/manual-labels`.

## TradeSignal
Represents detected trade signals. Entries are now created in `TradeTracker.logTradeSignal` whenever a message produces a valid trade. Signals can be listed via `/api/signals`.
The stats endpoint filters by `trade.channel.enabled` when counting these records. This avoids the `Unknown argument` error seen when querying by `channel` directly.

## ExecutionStats
Execution details for trades. Records are created and updated in `TradeTracker.trackTrade`, `TradeTracker.updateTrade` and the simulator.

## PerformanceHistory
Historical channel stats created by `channel_analyzer.py` whenever configs are updated and read by the stats API.

## ChannelConfig
Stores channel settings separately from the core `Channel` model. Configs can be created or updated with `POST /api/channel-config` and fetched via `/api/channel-config/:id`.


## TraderStats
Aggregated statistics for each trader within a channel. Updated in `TradeTracker.updateTraderStats` and fetched by the stats API.
The update logic now ignores trades without a recorded `profitLoss` so averages reflect only closed positions.
Filtering by channel status is performed via the `channel` relation (e.g. `{ channel: { enabled: true } }`) since the `TraderStats` table itself has no `enabled` field. Earlier code tried to filter directly by `enabled`, which caused Prisma validation errors.
New rows must provide `bestSymbols` and `tradingHours` (both `Json` columns). The code now supplies empty arrays when creating stats records to satisfy these required fields.

## BotStats
Overall bot performance metrics. Populated on-demand in `/api/bot-stats` when the endpoint is called.

## Data Quality Considerations
Every table should store accurate, complete information. Log data issues and define validation rules so future analytics are reliable. A dedicated steward can help enforce these standards.
Use the `npm run quality` command to quickly identify records with missing prices, invalid option types, unexpected status values or zero trade quantities.
These checks can also be executed via the `/api/data-quality` endpoint which returns any issues as JSON.
The Node server schedules this script daily so problems are logged automatically.
Log files are automatically removed after 30 days to keep the directory small.
Both Node entry points perform an environment check using `validateEnv` so missing variables cannot silently corrupt data.

