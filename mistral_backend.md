# Mistral Backend Documentation

This guide explains how the Python service (`api/mistral_server.py`) powers trade signal analysis. The FastAPI server loads a local Mistral model using the [`llama-cpp-python`](https://github.com/abetlen/llama-cpp-python) bindings and exposes REST endpoints consumed by the Node worker.

## Overview
- **Entry point**: `api/mistral_server.py`
- **Model Loader**: initializes the `Llama` class with a path from `model/`
- **Endpoints**:
  - `POST /analyze` — analyse a Discord message and return structured trade info
  - `GET /health` — simple health check plus GPU details
  - `GET /trade-history` — view active trades and recent history
- **Scheduled Jobs**: channel analysis, market calendar refresh and market news import run nightly via `schedule`.
- **Trade Context**: the server keeps a rolling history so exit signals can reference the most recent trade.

## Environment Variables
`mistral_server.py` reads settings from `.env` on startup. Important variables include:
- `MISTRAL_MODEL_PATH` – path to the `.gguf` model file
- `WEBHOOK_URL` – where analysis results are sent
- `CONFIDENCE_THRESHOLD` – minimum score for exit detection (default `0.8`)
- `CONFIDENCE_BASE` – base confidence used when calculating scores (default `0.7`)
- `CONFIDENCE_STEP` – increment per regex match (default `0.05`)

Additional variables such as database credentials or API keys may be referenced by other modules.

## Confidence Scoring
Exit detection uses regular expressions and calculates a dynamic confidence value based on how many patterns match. The thresholds listed above let you adjust tolerance without modifying code. Raising `CONFIDENCE_THRESHOLD` makes the server act only on stronger signals while lowering it makes detection more permissive.

## Goals for Improvement
The backend works but several areas could be refined:
- **Model Management** – loading can take several seconds; consider caching or warming to reduce startup time.
- **Error Handling** – many functions simply log exceptions. Returning clearer API errors and adding retry logic would improve reliability.
- **Testing** – automated tests for the analysis logic and scheduled jobs would catch regressions.
- **Resource Usage** – explore quantized models or batching to lower GPU load.

For a high level overview of how this service fits into the rest of the project see `DETAILS.md`. The Node worker communicates exclusively with the endpoints documented above.

