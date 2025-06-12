# Codex Prompt: Local Testing Setup with SQLite

📂 All generated files should be placed in a `/test/` directory at the root of the project.

Create a complete testing bootstrap setup for CopyTradeV3 that works entirely offline, using SQLite.

## 🎯 Goal
Enable local testing without needing access to a remote PostgreSQL database or external APIs. This will allow validation of all backend and database logic in isolation.

---

## ✅ Your Tasks

### 1. Create `/test/test-setup.sh`
- Creates `.env.test` with:
  ```env
  DATABASE_URL="file:./test.db"
  ADMIN_PASSWORD="testadmin"
  ```
- Runs:
  ```bash
  cp .env.test .env
  npx prisma generate
  npx prisma migrate dev --name init --skip-seed
  ```
- Installs Python and Node dependencies if missing
- Displays a final ✅ success message

### 2. Generate Prisma Test Seed Script
Create a file `test/test-seed.js` that:
- Connects to the `file:./test.db` SQLite instance
- Inserts test channels, a few mock trades, mock messages, and dummy model logs

### 3. Generate Node Test Suite
Under `test/api/`, create:
- `testTrades.js` — tests for `/api/trades`, inserts, filtering
- `testPositions.js` — tests for `/api/positions`
- `testSignals.js` — validate trade signals and `exitConfidence`

Use Jest + Supertest for HTTP API coverage.

### 4. Generate Python Test Suite
Under `tests/api/`, create:
- `test_analyze.py` — test `/analyze` with sample messages
- `test_health.py` — validate FastAPI health and GPU check
- `test_eval_job.py` — test model evaluation job with fake labels and logs

Use `pytest` + `httpx` + `sqlite://` for backend testability.

### 5. Write a Combined Runner
Add `test/run-tests.sh`:
```bash
#!/bin/bash
bash scripts/test-setup.sh
node scripts/test-seed.js
npm run test
pytest tests/api/
```

### 6. Do Not
- Use or connect to any remote database
- Trigger real Discord or Robinhood calls

---

Once all files are created, update CHANGES_SUMMARY.md to reflect:
- SQLite-based test support
- Local-only `.env.test`
- API + schema tests in isolation

> This setup should allow the project owner to run: `bash scripts/run-tests.sh` and validate any Codex-generated features fully offline.

