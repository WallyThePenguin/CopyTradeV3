# CopyTradeV2 Multi-Phase Roadmap

_Last updated: November 2025._ This plan turns CopyTradeV2 into a production-ready copy-trading platform through sequenced phases. Each phase lists its goals, key workstreams, and exit criteria.

## Phase 0 - Platform Stabilization

Goals: Replace PostgreSQL with a lightweight store, unblock local dev, harden the HTTPS/API surface, and document the true system boundaries.

- [x] Prisma + env migrated to SQLite (`file:./prisma/data/dev.db`) with fresh migrations and a seed script.
- [x] ChannelAnalyzer + Node worker aligned on SQLite schema, including callouts, price snapshots, execution stats, trader/bot metrics.
- [x] HTTPS-ready Express gateway (`start-secure-server.js`), TLS cert bootstrap, `helmet`/CORS/rate-limit middleware, and audited API keys.
- [x] Documentation consolidated into `docs/` with updated architecture snapshots.
- [x] Smoke-test Node + FastAPI services end-to-end using the new DB (Discord fixture -> callout -> trade -> dashboard).
- [x] Document manual steps for refreshing / validating the on-disk GGUF model weights (`docs/LLM_MODEL_MAINTENANCE.md`).

Exit criteria: One-click local setup (`npm install && npm run prisma:migrate && npm run start-secure`) works on a clean machine, HTTPS/WebSocket dashboards load, and analytics scripts run without errors.

## Phase 1 - Signal Reliability (in flight)

Goals: Make Discord ingestion plus LLM analysis deterministic with measurable confidence.

- Harden Discord queues (backpressure, retries, poison message handling).
- Version prompts + model responses; store structured analysis output in a normalized table.
- Build regression harness for the FastAPI model (golden datasets + drift alerts).
- Expand manual labeling tools (UI entry, scoring, and review queue).

Exit criteria: >=95% of monitored messages are processed within 5s, and we can replay the last 24h of signals deterministically.

## Phase 2 - Execution, Rate-Limiting & Risk Controls

_Current focus phase._ Goals: Bullet-proof trade execution, enforce per-trader budgets, and keep broker/API exposure within bounds.

- Normalize the trade lifecycle state machine (staged -> queued -> submitted -> filled -> closed) with explicit audit logs.
- Implement trader categorization + trust scores (extend `TraderStats` or add `TraderRules`) with nightly classification jobs using avg holding time, win rate, and signal frequency.
- Assign per-category request budgets (e.g., Swing Trusted vs Short-Term Bench) and persist overrides per trader.
- Introduce a Redis-backed `ensureTraderAllowed(traderId, category)` that enforces per-trader and per-category token buckets for all private/auth endpoints.
- Queue/schedule short-term executions (delay queue, high-priority swing queue) when rate buckets are empty; surface queue depth in the dashboard.
- Explore ingestion of additional signal sources (X streams, broker execution webhooks, Slack/Telegram) and normalize them into the existing callout pipeline so Discord is no longer the only feed.
- Add auto-benching workflows that monitor active short-term "good traders", bench the lowest trust scores when thresholds are exceeded, and expose status + overrides in the UI.
- Maintain broker abstractions so Robinhood + simulator share one interface, paving the way for additional brokers.

Exit criteria: Sim/live modes share the same guarded pipelines, private endpoints observe trader/category quotas, and automated guards prevent order spam or oversized exposure.

## Phase 3 - Intelligence & Analytics

Goals: Turn captured data into actionable intelligence.

- Rebuild trader/channel analytics using SQLite-compatible materialized views or nightly jobs.
- Surface advanced dashboards (expectancy, drawdowns, time-based habits, news impact).
- Introduce A/B testing for strategies + automated strategy scoring.
- Enhance news/calendar modules with vendor integrations.

Exit criteria: Dashboard users can compare traders/channels with drill-downs, and weekly summary packs are auto-generated.

## Phase 4 - Scale & Distribution

Goals: Productionize for multiple brokers, teams, and environments.

- Introduce profile-based config (`dev`, `paper`, `prod`) with secrets vault integration.
- Add broker adapters (Interactive Brokers, Alpaca) and order routing policy engine.
- Ship public API keys + OAuth for managed access.
- Containerize Node + FastAPI services and add CI/CD with health checks and migrations.
- Graduate from SQLite back to managed PostgreSQL once processes, data models, and validation suites are stable; update Prisma datasource/migrations accordingly.

Exit criteria: We can onboard a new workspace (broker + Discord org) in under one day with zero-downtime deployments.

## Cross-Cutting Enablers

- Observability: structured logging, telemetry traces, Grafana dashboards.
- QA: contract tests for Discord + broker mocks, load tests for the WebSocket server, regression suite for models.
- Security: secrets scanning, role-based admin actions, TLS-by-default, audit-ready logs.

## Immediate Next Steps

1. **Schema + classification job**: extend Prisma (`TraderStats` or new `TraderRules`) with `category`, `trustScore`, `requestBudget`, `benchUntil`, and build a nightly job that recomputes categories from holding time + win rate stats.
2. **Redis-backed enforcement**: add `ensureTraderAllowed(traderId, category)` that manages per-trader and per-category token buckets for private endpoints (orders, `/marketdata/options`, etc.) plus bench flags.
3. **Queueing & scheduling**: implement high-priority swing queues and delay queues for short-term traders so requests wait until buckets refill; surface queue depth + next-available times in the dashboard.
4. **Auto-benching monitor**: hourly job that ranks "good" short-term traders, benches the lowest trustScore ones when concurrency > threshold, and stores reason/expiry in Redis + Prisma for UI overrides.
5. **LLM asset maintenance + smoke tests**: document GGUF refresh steps and wire a repeatable smoke test that ingests fixture Discord messages and verifies downstream DB rows once the new enforcement layer is stable.
