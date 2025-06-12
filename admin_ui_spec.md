# Admin UI Specification

## Purpose
The Admin UI lets the project owner manage all critical tables, manually override labels, monitor LLM decisions, and debug issues in real time.

## Access Control
- Password required: read from `.env` via `ADMIN_PASSWORD`
- Guests see only the public dashboard (no admin panel)

## Layout
Use a sidebar navigation with one tab per table:
- Trades
- TradeSignals
- Messages
- ModelLogs
- ManualLabels
- ExecutionAuditLog
- MarketUpdates
- MarketCalendar
- OrderRecords
- PerformanceHistory
- JobLogs
- ModelEvalResult

## Table Viewer Behavior
Each tab should:
- Fetch paginated entries via REST (`/api/[table]`)
- Support search/filter (e.g. by date, channelId, or status)
- Columns: field list + expandable raw JSON blob if applicable

## Editable Fields
- `ManualLabel.confidence`, `label`
- `ChannelConfig.isEnabled`, `minConfidence`
- `MarketUpdate.summary`, `sentiment`

## Actions
- View: all tables (read-only except below)
- Edit: inline or modal
- Create: use modal to insert new label or config
- Delete: not exposed unless explicitly added later

## WebSocket Sync
Admin table views should update live from WebSocket messages if new data is inserted.

## Example: Trades Tab
- Columns: symbol, action, status, entryPrice, exitPrice, P&L, createdAt
- Sortable by createdAt or P&L
- Link to raw ExecutionAuditLog entries

## Styling Notes
- Keep styling minimal: light/dark toggle, monospaced font for JSON
- Use expandable rows for nested objects
- Highlight rows with error states (e.g., missing exitPrice)

## Future Tabs (optional)
- Model Accuracy Trends (graph from ModelEvalResult)
- Signal Quality View (correlate `TradeSignal` with `ExecutionStats`)

