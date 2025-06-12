# AI Suggestions

This document collects ideas and reminders for future contributors (including future Codex agents) about how to further enhance the project. It complements `TODO.md` with more opinionated guidance.

## Short‑Term Improvements

- **Complete Table Coverage**
  - The Prisma schema defines several models that lacked create/update logic. `TradeSignal` and `ChannelConfig` are now persisted, joining `MarketUpdate` and `ManualLabel`.
  - Ensure future tables also receive write paths so important events always result in a database record.
- **Webhook Embeds**
  - Revisit the notification format to include symbol, strike, expiration, author/channel, and profit/loss once available. This will make trade alerts on Discord far more useful. *Done – embeds now include these fields.*
- **Real Price Feeds**
  - The current simulator generates entry/exit prices. A basic hook now fetches quotes from Robinhood for stoploss checks, but a full data feed is still recommended for accurate P&L.
  - A new `/api/historical-prices` endpoint retrieves recent candles from Robinhood to help chart performance.
- **Service Reliability**
  - Ensure the `initialize()` method on `robinhood.js` is called during startup so tokens are loaded before trades are executed. *Now handled via a startup call in `web/server.js` and within `TradeTracker` before orders are placed.*
  - Add automatic re-login when a Robinhood session expires so trades do not fail unexpectedly. *Implemented in `robinhood.js`.*
  - Load environment variables from `.env` in the Python server to reduce setup steps. *Implemented via `load_dotenv`.*
- **UI Refinements**
  - Ensure mode and period selectors always reflect the active view.
  - Display the trader/channel responsible for each trade in the "Recent Trades" table.
  - Add combined statistics for all simulated channels so performance can be assessed before enabling them. *Implemented via new `mode` filter on `/api/channels` and `/api/trades`.*
  - Provide a way to inspect open positions via the API so the UI can show current holdings. *A new `/api/positions` endpoint now exposes this information.*
  - Display these positions in the dashboard so users can monitor holdings at a glance. *Implemented via a new table.*
  - Consider surfacing order history through an API endpoint so users can verify executions. *Implemented via `/api/order-history`.*
  - Persist retrieved orders in the database so the system maintains a permanent audit trail. `/api/order-records` exposes these saved orders.
- **Market Calendar Table**
  - A `MarketCalendar` model and Python ingestion script now exist. Upcoming events are available via `/api/market-calendar`. *The FastAPI server now calls `update_market_calendar()` every night so upcoming catalysts appear automatically.*
 - **Automatic Market Updates**
  - Populate `MarketUpdate` entries from news feeds or broker APIs. Robinhood surfaces market news on individual stocks; consider polling these endpoints or a free service like IEX Cloud. *`api/market_news.py` now imports a JSON feed nightly as a proof of concept.*
- **Data Quality Standards**
  - Poor data hurts model training and decision making. The `npm run quality` script now reports missing prices, invalid option types, bad statuses and zero quantities. Define rules based on this output and appoint a steward to check the report regularly.

## Medium‑Term Goals

- **Authentication & Security**
  - Basic API key authentication now guards write routes. Future work should refine this with proper token or session handling and potentially role‑based permissions.
- **Unified Logging**
  - Introduce a logging library (e.g., Winston for Node, `structlog` for Python) with consistent formatting and file rotation. Push important errors to a monitoring service.
- **Automated Testing**
  - While the MVP removed test suites, a small collection of integration tests would help catch regressions as features expand. Focus on critical flows like trade creation and stats calculations.
- **Deployment Pipeline**
  - Set up containerization or a lightweight CI/CD workflow. The repository currently contains many installed dependencies; a Dockerfile or setup script would streamline deployment.
  - `setup.sh` (and `setup.bat`) now install dependencies and recreate the Python virtual environment, so `api/venv` no longer needs to be tracked.
  - Secrets should live outside the repo. Copy `.env.example` to `.env` and keep your credentials local.

## Long‑Term Vision

- **Algorithm Training**
  - The end goal is to collect enough labeled trade data to train models that evaluate trader performance or suggest trades automatically. Keep this dataset well organized and consider periodic exports for backup.
- **Scalability**
  - As more channels and traders are added, database indexes and query efficiency will matter. Monitor performance and optimize Prisma queries as needed.
- **Broker Integration**
  - Robinhood is used as a placeholder. Investigate more robust brokerage APIs for production trading with better reliability and rate limits.

These notes should help future developers focus efforts where they will have the most impact.
