# TODO / Roadmap for Production-Ready CopyTradeV3

This file reflects the next major milestones needed to move from MVP toward a polished, long-term product. It merges unfinished tasks from the original TODO.md with new production-level goals.

---

## 🔁 DATA ENRICHMENT

- [ ] **Enrich `ExecutionStats` Table**  
  - Store detailed broker execution metadata (e.g., filled quantity, timestamps, order type, time-in-force).
  - Include per-leg fills if available.

- [ ] **Add `ExecutionAuditLog` Table**  
  - Capture every API response and decision related to order lifecycle.
  - Used to reconstruct audit trail for real/live trades.

- [ ] **Expand Robinhood Data Capture**
  - Pull full instrument metadata (sector, market cap, etc.)
  - Option chain greeks (IV, delta, theta) where available.
  - Persist all of this into new or existing tables.

- [ ] **Track Message → Trade Lifecycle**
  - Log message metadata, LLM decision confidence, and resulting trade into a single unified view.

- [ ] **Ensure every Prisma model has a write path**
  - Confirm all schema models (existing and future) are persisted. Originally missing models like `TradeSignal`, `ChannelConfig` now supported — ensure all others are covered.

---

## 📊 MODEL ACCURACY & CONFIDENCE

- [ ] **Implement `/api/analysis-metrics` Endpoint**  
  - Calculates precision/recall, confusion matrix, model drift.
  - Uses `ManualLabel` and `ModelLog` tables.

- [ ] **UI View for Model Logs**  
  - View prompts, responses, confidence score, and result.
  - Filter by trader, keyword, or confidence range.

- [ ] **Exit Detection Evaluation Dashboard**
  - Highlight low-confidence exits.
  - Manual override possible via dashboard.

- [ ] **Regex & Prompt Tuning**
  - Expand slang/emoji/abbreviation detection.
  - Add newer patterns from recent trading messages.
  - Use `CONFIDENCE_THRESHOLD` and scoring logic to control behavior.

---

## 🌐 WEB UI UPGRADE

- [ ] **Admin Dashboard (All Tables)**
  - Read views for every table: Messages, Trades, ModelLogs, MarketUpdates, etc.
  - Write access for: ManualLabels, ChannelConfigs, MarketUpdates.

- [ ] **P&L Trend View**
  - Per-trade P&L sparkline
  - Cumulative profit tracking over time

- [ ] **Real-Time Debug Panel**
  - Recent trade decisions, model responses, and WebSocket status

- [ ] **Error / Data Quality Alerts**
  - View daily logs of missing/invalid data
  - Trigger re-analysis or repair from UI

- [ ] **Show per-trade channel/trader info in UI**
  - Done in MVP, verify it's consistent across all views

- [ ] **Fix P&L bugs in trader stats**
  - Ensure trades without exit prices are excluded from average calcs

- [ ] **UI mode selector improvements**
  - Period and mode toggles should reflect active view cleanly

---

## 🧠 BACKEND INFRASTRUCTURE

- [ ] **Create Test Suites**
  - Jest: REST endpoints, message → trade
  - Pytest: LLM analysis, scheduled job integrity

- [ ] **Dockerize Backend**
  - Node + Python services in container
  - GPU support for Mistral

- [ ] **Staging Mode Support**
  - Toggle to point to a testing DB + mock Robinhood

- [ ] **Webhook Retry Queue**
  - If delivery fails, retry posting LLM results or trade notifications

- [ ] **Add file-based job logging**
  - Extend structured logging for job status, include timestamp and result

---

## 📆 SCHEDULING / CRONS

- [ ] **Verify Daily Job Health**
  - Channel Analyzer
  - Market Calendar
  - Market News Import
  - Data Quality Check

- [ ] **Add Job Logs Table**
  - Store timestamped records of each nightly job run
  - Include error messages if any

- [ ] **Add `/api/refresh-market-news` endpoint**
  - Already implemented — confirm UI can call this on demand

---

## 🔐 SECURITY & STABILITY

- [ ] **Web UI Auth Layer**
  - Add password or token-based access
  - Admin-only pages

- [ ] **Prisma Input Validation**
  - Sanitize inputs from API POSTs

- [ ] **Rate Limiting**
  - Prevent abuse of POST endpoints (e.g. manual labels)

- [ ] **Session Token Audit for Robinhood**
  - Alert if session is invalid and can't auto-refresh

- [ ] **Validate environment vars at startup**
  - Done for Node; ensure Python service mirrors this behavior

---

## 🧠 LONG TERM

- [ ] **Alternative Broker Support**
  - Investigate Alpaca, IBKR, TastyTrade APIs

- [ ] **Automated Trade Evaluation Model**
  - Train ML model on labeled signals + historical outcomes
  - Output signal confidence or P&L projection

- [ ] **Export / Backup Tools**
  - Manual and scheduled PostgreSQL dumps

- [ ] **Quantitative Metrics Leaderboard**
  - Rank channels based on Sharpe, drawdown, win rate, and more

- [ ] **Old log cleanup job**
  - Ensure all logs older than 30 days are purged (already partially implemented)

---

This document should evolve weekly as more subsystems are stabilized and verified.

