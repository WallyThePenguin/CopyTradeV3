# TODO / Suggestions

The following items outline areas where the project could be expanded or refined. They are based on the current code base and the goal of capturing detailed trade data for algorithmic training.

Progress: model logs are now persisted whenever a message is analysed. Manual labels
and market updates can be created through the Web UI API. A `/api/market-calendar`
endpoint now exposes upcoming economic events from the new `MarketCalendar` table.
The market calendar is refreshed automatically each night and both Node and Python
write to the same log directory.

- **Improve Webhook Embeds** – include all trade fields (symbol, strike, expiry, P/L and author) so Discord notifications show meaningful context. *Completed: embeds now include these details.*
- **Integrate Live Pricing** – fetch actual entry and exit prices from a broker or market data API to replace simulated values.
- **Persist Every Table** – add write logic for all schema models. `TradeSignal` and `ChannelConfig` now have create/update paths alongside `MarketUpdate` and `ManualLabel`.
- **Unified Logging** – add a central logging service or library so both Node.js and Python components record structured logs. *Done: Node and Python use file-based loggers under `data/logs`.*
- **Authentication** – secure the API and Web UI with token or session based auth before exposing it publicly.
- **WebUI Enhancements** –
  - Fix P&L calculation issues in trader stats.
  - Display which channel or trader executed each trade in the recent trades table.
  - Ensure period-selection buttons update the timeframe correctly.
  - Allow combined performance view across all simulated channels.
  - When "Production" mode is selected, show only enabled channels.
- **Data Analysis Scheduling** – verify that `channel_analyzer.py` runs daily and consider storing its output for later use. *Scheduled along with nightly market calendar updates.*
- **Repository Cleanup** – remove committed virtual environments and document setup commands to keep the repository lightweight. *`api/venv` is now git‑ignored and recreated with `setup.sh` or `setup.bat`.*
- **Documentation** – expand `SCHEMA_DETAILS.md` and `DETAILS.md` with up to date explanations of features and database usage.
 - **Market Calendar Table** – a `MarketCalendar` model now exists and events can be queried via `/api/market-calendar`. *The FastAPI server now calls `update_market_calendar()` nightly.*
- **Auto-Populate Market Updates** – hook the `MarketUpdate` table to a news feed or broker API so live market headlines are captured automatically.
- **Data Quality Plan** – document known issues, create collection standards and assign a steward to verify new data. Bad data can be expensive and lead to poor decisions.

These improvements will help achieve the goal of collecting comprehensive trader data while keeping the system maintainable and secure.
