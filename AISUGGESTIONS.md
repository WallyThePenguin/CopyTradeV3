# AI Suggestions

This document collects ideas and reminders for future contributors (including future Codex agents) about how to further enhance the project. It complements `TODO.md` with more opinionated guidance.

## Short‑Term Improvements

- **Complete Table Coverage**
  - The Prisma schema defines several models that lacked create/update logic. `TradeSignal` and `ChannelConfig` are now persisted, joining `MarketUpdate` and `ManualLabel`.
  - Ensure future tables also receive write paths so important events always result in a database record.
- **Webhook Embeds**
  - Revisit the notification format to include symbol, strike, expiration, author/channel, and profit/loss once available. This will make trade alerts on Discord far more useful.
- **Real Price Feeds**
  - The current simulator generates entry/exit prices. Integrate a reliable market data API so simulated trades mirror real‑world moves and P&L calculations become accurate.
- **UI Refinements**
  - Ensure mode and period selectors always reflect the active view.
  - Display the trader/channel responsible for each trade in the "Recent Trades" table.
  - Add combined statistics for all simulated channels so performance can be assessed before enabling them.
- **Market Calendar Table**
  - A `MarketCalendar` model and Python ingestion script now exist. Schedule the script periodically to pull the Federal Reserve calendar or a free API so upcoming catalysts appear in the UI.
- **Automatic Market Updates**
  - Populate `MarketUpdate` entries from news feeds or broker APIs. Robinhood surfaces market news on individual stocks; consider polling these endpoints or a free service like IEX Cloud.
- **Data Quality Standards**
  - Poor data hurts model training and decision making. List common issues, set clear quality rules for all contributors and appoint a steward to check new entries.

## Medium‑Term Goals

- **Authentication & Security**
  - Add token or session based auth for all API routes. Consider role‑based permissions if the system will be accessed by multiple users.
- **Unified Logging**
  - Introduce a logging library (e.g., Winston for Node, `structlog` for Python) with consistent formatting and file rotation. Push important errors to a monitoring service.
- **Automated Testing**
  - While the MVP removed test suites, a small collection of integration tests would help catch regressions as features expand. Focus on critical flows like trade creation and stats calculations.
- **Deployment Pipeline**
  - Set up containerization or a lightweight CI/CD workflow. The repository currently contains many installed dependencies; a Dockerfile or setup script would streamline deployment.

## Long‑Term Vision

- **Algorithm Training**
  - The end goal is to collect enough labeled trade data to train models that evaluate trader performance or suggest trades automatically. Keep this dataset well organized and consider periodic exports for backup.
- **Scalability**
  - As more channels and traders are added, database indexes and query efficiency will matter. Monitor performance and optimize Prisma queries as needed.
- **Broker Integration**
  - Robinhood is used as a placeholder. Investigate more robust brokerage APIs for production trading with better reliability and rate limits.

These notes should help future developers focus efforts where they will have the most impact.
