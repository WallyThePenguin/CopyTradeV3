# Codex Execution Prompt for CopyTradeV3

This is your primary instruction set for Codex agents tasked with maintaining or expanding CopyTradeV3. This system processes Discord messages, extracts trading signals, stores them in a PostgreSQL database, and optionally executes orders through Robinhood. Your job is to read, understand, and extend the system accurately.

## 📚 Reference Files

Before doing anything, **read all the following markdown files**:

1. `README.md` — architecture, API endpoints, setup instructions
2. `AGENTS.md` — current system status and features
3. `DETAILS.md` — component interactions and data flow
4. `SCHEMA_DETAILS.md` — Prisma models and how they’re used
5. `TODO.md` — priority roadmap and gaps
6. `AISUGGESTIONS.md` — long-term enhancement ideas and improvement notes
7. `execution_audit.md` — execution log tracking design
8. `model_accuracy_eval.md` — nightly evaluation system for LLM accuracy
9. `admin_ui_spec.md` — requirements for admin dashboard panel
10. `job_logging.md` — nightly task auditing through `JobLog`
11. `database_audit_strategy.md` — rules for structured logging and long-term data reliability

## ✅ Your Tasks

Codex, your job is to:

### 1. **Implement All Incomplete TODOs**

- Work from the `TODO.md` list
- Implement any backend or frontend logic as described
- If missing schemas are noted, generate and integrate them using Prisma

### 2. **Follow Detailed Feature Specs**

- Use `execution_audit.md` to build and populate `ExecutionAuditLog`
- Use `model_accuracy_eval.md` to implement `/api/analysis-metrics`, `ModelEvalResult`, and nightly LLM comparison
- Use `admin_ui_spec.md` to create admin-only dashboard tabs with live table viewers
- Use `job_logging.md` to replace file-based logs with `JobLog` schema + daily write logic
- Use `database_audit_strategy.md` to keep all system behavior queryable and trackable inside SQL

### 3. **Use Environment Config for Access Control**

- Use a `.env` variable like `ADMIN_PASSWORD` to gate admin UI functionality

### 4. **Store All Logs and Records in SQL**

- Do not write to log files
- Use `ExecutionAuditLog`, `JobLog`, and `ModelEvalResult` for tracking system state

### 5. **Make All Code Modular**

- Node backend: put logic in appropriate `/services/` files
- Python backend: put evaluation logic inside `mistral_server.py` or a helper file
- Web UI: use React components organized by feature group

### 6. **Write Clean, Maintainable Code**

- Validate all Prisma writes
- Use clear naming conventions
- Respect API standards (RESTful, auth-protected POSTs)
- Use JSON logs when inserting structured audit records

## 🧠 Strategic Purpose

This system is not just an MVP. The long-term goal is:

- Full traceability of trade decisions from message to execution
- LLM evaluation and model training based on real human signals
- Secure, admin-only tooling for one user

Your changes must move the project toward a stable, production-grade product suitable for training machine learning models in the future.

**You are now authorized to execute. Read the above docs. Implement the requested features. Do not proceed until all files have been fully parsed.**

