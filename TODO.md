# TODO / Suggestions

The following items outline areas where the project could be expanded or refined. They are based on the current code base and the goal of capturing detailed trade data for algorithmic training.

Progress: model logs are now persisted whenever a message is analysed.

- **Improve Webhook Embeds** – include all trade fields (symbol, strike, expiry, P/L and author) so Discord notifications show meaningful context.
- **Integrate Live Pricing** – fetch actual entry and exit prices from a broker or market data API to replace simulated values.
- **Persist Every Table** – many schema models are unused. Add write logic for `MarketUpdate`, `ManualLabel`, `TradeSignal` and `ChannelConfig` so rows are created during normal operation.
- **Unified Logging** – add a central logging service or library so both Node.js and Python components record structured logs.
- **Authentication** – secure the API and Web UI with token or session based auth before exposing it publicly.
- **WebUI Enhancements** –
  - Fix P&L calculation issues in trader stats.
  - Display which channel or trader executed each trade in the recent trades table.
  - Remove the obsolete "All" button and rename "Test mode" to "Simulated".
  - Ensure period-selection buttons update the timeframe correctly.
  - Allow combined performance view across all simulated channels.
  - When "Production" mode is selected, show only enabled channels.
- **Data Analysis Scheduling** – verify that `channel_analyzer.py` runs daily and consider storing its output for later use.
- **Repository Cleanup** – remove committed virtual environments and document setup commands to keep the repository lightweight.
- **Documentation** – expand `SCHEMA_DETAILS.md` and `DETAILS.md` with up to date explanations of features and database usage.

These improvements will help achieve the goal of collecting comprehensive trader data while keeping the system maintainable and secure.
