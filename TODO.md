# TODO / Suggestions

The following items outline areas where the project could be expanded or refined. They are based on the current code base and the goal of capturing detailed trade data for algorithmic training.

Progress: model logs are now persisted whenever a message is analysed. Manual labels
and market updates can be created through the Web UI API. A `/api/market-calendar`
endpoint now exposes upcoming economic events from the new `MarketCalendar` table.
The market calendar is refreshed automatically each night and both Node and Python
write to the same log directory.

- **Improve Webhook Embeds** – include all trade fields (symbol, strike, expiry, P/L and author) so Discord notifications show meaningful context. *Completed: embeds now include these details.*
- **Integrate Live Pricing** – fetch actual entry and exit prices from a broker or market data API to replace simulated values. *In progress: `getCurrentPrice` in `mistral.js` now retrieves real quotes and `/api/historical-prices` returns recent candles.*
- **Persist Every Table** – add write logic for all schema models. `TradeSignal` and `ChannelConfig` now have create/update paths alongside `MarketUpdate` and `ManualLabel`.
- **Order Record Persistence** – store retrieved orders in a dedicated table so historical executions can be reviewed. `/api/order-records` now exposes this data.
- **Unified Logging** – add a central logging service or library so both Node.js and Python components record structured logs. *Done: Node and Python use file-based loggers under `data/logs`.*
- **Environment Loading** – ensure the FastAPI service reads variables from `.env` automatically so manual exports aren't required. *Implemented via `load_dotenv` in `mistral_server.py`.*
- **Authentication** – basic API key protection added to POST routes. Review session based auth for the Web UI in the future.
- **WebUI Enhancements** –
  - Fix P&L calculation issues in trader stats. *Done: `updateTraderStats` now ignores trades without a profit/loss value.*
  - Display which channel or trader executed each trade in the recent trades table. *Done*
  - Ensure period-selection buttons update the timeframe correctly. *Done: buttons now remain highlighted when modes change.*
  - Allow combined performance view across all simulated channels. *Done: channel selector reloads by mode and "Simulated" now aggregates disabled channels.*
  - When "Production" mode is selected, show only enabled channels. *Done via `mode` query on `/api/channels`.*
  - Add an endpoint to fetch open positions so the dashboard can display current holdings. *Implemented as `/api/positions`.*
  - Add an endpoint to view recent order history so trades can be audited easily. *Implemented as `/api/order-history`.*
  - Show open positions in the dashboard using the new endpoint. *Done: a table now lists active holdings.*
  - Provide a way to fetch recent historical prices for charts. *New `/api/historical-prices` endpoint added.*
- **Data Analysis Scheduling** – verify that `channel_analyzer.py` runs daily and consider storing its output for later use. *Scheduled along with nightly market calendar updates.*
- **Repository Cleanup** – remove committed virtual environments and document setup commands to keep the repository lightweight. *`api/venv` is now git‑ignored and recreated with `setup.sh` or `setup.bat`.* `.env` is now git‑ignored and a `.env.example` file lists the required variables.
- **Documentation** – expand `SCHEMA_DETAILS.md` and `DETAILS.md` with up to date explanations of features and database usage.
- **Robinhood Initialization Fix** – expose an `initialize()` method on `robinhood.js` so the simulator and trading service can safely start. *Completed: `web/server.js` initializes the trading service on startup and `TradeTracker` ensures it before each order.*
- **Robinhood Session Refresh** – automatically re-login when the stored token becomes invalid so trades can continue without manual intervention. *Implemented in `robinhood.js`.*
 - **Market Calendar Table** – a `MarketCalendar` model now exists and events can be queried via `/api/market-calendar`. *The FastAPI server now calls `update_market_calendar()` nightly.*
 - **Auto-Populate Market Updates** – hook the `MarketUpdate` table to a news feed or broker API so live market headlines are captured automatically. *In progress: `api/market_news.py` imports a JSON feed each night via the FastAPI scheduler.*
 - **Data Quality Plan** – run the new `npm run quality` script to flag missing fields or invalid trades. The script now also checks for invalid trade statuses and zero quantities. Assign a steward to review the report regularly.

These improvements will help achieve the goal of collecting comprehensive trader data while keeping the system maintainable and secure.
