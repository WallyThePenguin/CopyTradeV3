# CopyTradeV3: AI-Powered Trading Message Analysis

## Overview

CopyTradeV3 is an advanced trading message analysis backend that combines:
- **Regex-based pre-filtering** for ultra-fast detection of buy/sell/exit signals (including Gen Z slang, abbreviations, and emoji)
- **LLM (Large Language Model) confirmation** for high-accuracy trade intent detection
- **Context-rich LLM prompts** for extracting detailed trade information
- **Webhook integration** to send all analysis results to your custom endpoint in real time
- **Model logging** stores every analysis result in the database for later review
- **Optimized GPU inference** for sub-5s response times on consumer GPUs (e.g., RTX 2060 Super)

## How It Works

1. **Message Received**: The API receives a trading message (e.g., from Discord, Telegram, etc).
2. **Regex Pre-Filter**: The message is scanned for buy/sell/exit keywords, abbreviations, and Gen Z slang/emoji.
3. **LLM Confirmation**: If a keyword is found, a focused LLM prompt confirms if the message is truly a buy/sell/exit signal (prevents false positives).
4. **Full LLM Analysis**: If not confirmed, a context-rich prompt (with examples) is sent to the LLM to extract all possible trade details.
5. **Webhook**: The result (including errors) is POSTed to your `WEBHOOK_URL`.
6. **Fast Inference**: The model is loaded once at startup and runs on GPU for maximum speed.

## Features
- **Gen Z/Abbreviation/Emoji Support**: Regex patterns and LLM prompts are tuned for modern trading lingo.
- **Example-Driven LLM Prompts**: Prompts include real-world examples for better accuracy.
- **Webhook Integration**: All results are sent to your webhook for further automation.
- **Detailed Discord Embeds**: Webhook messages now include strike, optional expiration and real-time P&L when available.
- **Error Handling**: All errors are logged and sent to the webhook.
- **Extensible**: Add more regex patterns, examples, or context as needed.
- **Manual Labels & Market Updates**: The API can store human-provided labels and short market summaries for later analysis.
- **Trade Signal & Channel Config Storage**: Confirmed signals and per-channel settings persist through dedicated endpoints.
- **Market Calendar**: A helper script populates a `MarketCalendar` table with events from an ICS feed, and `/api/market-calendar` exposes upcoming events.
- **Market News Importer**: `api/market_news.py` reads a JSON feed nightly to create `MarketUpdate` records automatically.
- **Daily Calendar Updates**: The FastAPI server refreshes the market calendar every night so new events appear automatically.
- **Unified Logging**: Both the Node and Python services write logs to `data/logs` for easier troubleshooting.
- **Live Price Checks**: `mistral.js` fetches current quotes from Robinhood to evaluate stoploss and take‑profit conditions.
- **Service Initialization**: The trading service now initializes automatically when the web server starts and is verified before each order so Robinhood sessions remain valid.
- **Account Positions Endpoint**: `/api/positions` exposes current holdings from the active trading service.
- **Order History Endpoint**: `/api/order-history` lists recent orders from the trading service.
- **Historical Price Endpoint**: `/api/historical-prices` fetches recent market data from Robinhood.
- **Order Records Table**: order history responses are now persisted to the `OrderRecord` table and can be queried via `/api/order-records`.
- **Open Positions Dashboard**: A new table on the web UI shows current holdings retrieved from `/api/positions`.
- **Environment Loader**: The Python backend loads variables from `.env` at startup so separate export steps aren't needed.
- **Session Auto-Refresh**: `robinhood.js` re-logins automatically when its token expires.
- **Data Quality Focus**: Bad data is expensive and leads to poor decisions. The `npm run quality` script now flags missing prices, invalid option types, bad statuses and zero quantities so issues can be resolved quickly.

## Setup

1. **Clone the repo**
2. **Install dependencies** by running `bash setup.sh` on Linux/macOS or `setup.bat` on Windows. This script creates a fresh Python virtual environment under `api/venv` and installs both Python and Node packages.
3. **Copy `.env.example` to `.env`** and update the values for your environment. At minimum set `WEBHOOK_URL`, `DISCORD_TOKEN` and database credentials. `API_KEY` is optional but recommended for securing POST routes.
   The FastAPI service reads this file automatically on startup.
4. **Configure your model path and GPU settings** in `mistral_server.py` (see `initialize_model`)
5. **Run the Python backend**:
```bash
  uvicorn mistral_server:app --host 0.0.0.0 --port 8000
  ```
6. **Run the Node worker**:
 ```bash
 npm start
 ```
 On Windows you can start both services with `start.bat`, which opens two terminals for the Python and Node processes.
7. **Optional**: manually refresh the market calendar
```bash
python api/market_calendar.py
```
The FastAPI server updates the calendar nightly, but this command forces an immediate refresh.
8. **Optional**: import the sample market news feed
```bash
python api/market_news.py
```
This populates the `MarketUpdate` table using `data/news/sample_news.json`.
9. **Optional**: run a data quality check
```bash
npm run quality
```
This script scans the database for missing or invalid fields.

The virtual environment created by `setup.sh` (or `setup.bat`) lives in `api/venv` and is ignored by git.

## API Usage

- **POST /analyze**
  - Request: `{ "content": "QQQ 515 P" }`
  - Response: JSON with trade signal info, confidence, and timing
  - Webhook: Same JSON is POSTed to your `WEBHOOK_URL`
  - Include `X-API-KEY` header if `API_KEY` is configured
- **POST /api/market-updates**
  - Create a market summary record: `{ "channelId": "id", "messageId": "123", "summary": "FOMC today", "sentiment": "NEUTRAL" }`
  - Updates may come from news APIs or broker feeds so the database tracks significant headlines.
  - Include `X-API-KEY` header if `API_KEY` is configured
- **POST /api/manual-labels**
  - Label a message manually: `{ "messageId": "123", "label": "SCALP", "confidence": 0.9 }`
  - Use these labels to build a high quality training set for future models.
  - Include `X-API-KEY` header if `API_KEY` is configured
- **POST /api/channel-config**
  - Save per-channel settings: `{ "channelId": "123", "isEnabled": true, "minConfidence": 0.8 }`
  - Include `X-API-KEY` header if `API_KEY` is configured
- **GET /api/market-calendar**
  - List upcoming economic events stored in the `MarketCalendar` table.
- **GET /api/signals**
  - List recent trade signals with optional `limit` parameter.
- **GET /api/trades**
  - List recent trades. Supports `mode` (`TEST`, `PROD` or `ALL`) and `channel` query parameters.
- **GET /api/positions**
  - Retrieve current account positions from the active trading service.
- **GET /api/order-history**
  - Retrieve the most recent orders from the trading service.
- **GET /api/historical-prices**
  - Retrieve recent price data for a symbol. Optional `interval` and `span` query parameters mirror Robinhood's historical endpoint.
- **GET /api/order-records**
  - List stored broker orders from the `OrderRecord` table. Optional `limit` query param controls how many results are returned.
- **GET /api/channels?mode=TYPE**
  - Retrieve channels filtered by `mode`. `TYPE` can be `TEST` for disabled channels, `PROD` for enabled channels or omitted for all.

## Example Regex/LLM Flow

- Message: `"im out 🚀"`
  - Regex: matches exit/sell
  - LLM: confirms if it's truly a sell/exit
  - Result: `{ "isTradeSignal": true, "action": "SELL", ... }`

- Message: `"SPY 582 C"`
  - Regex: matches buy
  - LLM: confirms if it's truly a buy
  - Result: `{ "isTradeSignal": true, "action": "BUY", ... }`

- Message: `"Levels to watch: Over 583.75"`
  - Regex: no match
  - LLM: full analysis for levels, not a trade
  - Result: `{ "isTradeSignal": false, ... }`

## Customization
- **Add more regex patterns** in `mistral_server.py` for new slang/abbreviations
- **Add more LLM examples** to improve accuracy
- **Tune model settings** for your GPU in `initialize_model()`

## Data Quality
Bad data can cost organizations millions each year and leads to poor decisions. Set quality standards and review incoming records regularly. A helper script is available:

```bash
npm run quality
```

The command checks the database for common issues like missing exit prices, invalid option types,
unexpected trade status values or zero quantities.


## License
MIT

## Architecture

The project is split into two main components:

1. **Python FastAPI Server** (`api/mistral_server.py`)
   - Handles Mistral model inference
   - Runs on GPU (RTX 2060 Super)
   - Provides REST API endpoints

2. **Node.js Application** (`src/index.js`)
   - Handles Discord bot functionality
   - Manages trade tracking
   - Communicates with Python server

## Prerequisites

- Node.js 18+
- Python 3.10+
- CUDA 11.8+
- RTX 2060 Super (8GB VRAM)
- Discord Bot Token
- Robinhood Account

## Project Structure

```
├── api/                    # Python FastAPI server
│   ├── mistral_server.py   # Main FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── utils/             # Python utility functions
│       └── gpu.py         # GPU management utilities
│
├── src/                    # Node.js application
│   ├── index.js           # Main application entry
│   ├── config/            # Configuration files
│   │   ├── channels.js    # Discord channel config
│   │   └── settings.js    # Application settings
│   │
│   ├── services/          # Core services
│   │   ├── mistral.js     # Mistral API client
│   │   ├── discord.js     # Discord bot service
│   │   └── robinhood.js   # Robinhood trading service
│   │
│   ├── models/            # Data models
│   │   ├── trade.js       # Trade data model
│   │   └── signal.js      # Signal data model
│   │
│   └── utils/             # Utility functions
│       ├── logger.js      # Logging utilities
│       └── helpers.js     # Helper functions
│
├── models/                # ML model files
│   └── mistral-7b-instruct-v0.2.Q4_K_M.gguf
│
├── data/                  # Data storage
│   ├── trades/           # Trade history
│   └── logs/             # Application logs
│
├── tests/                # Test files
│   ├── api/             # API tests
│   └── src/             # Node.js tests
│
├── scripts/              # Utility scripts
│   ├── setup.sh         # Setup script
│   └── backup.sh        # Backup script
│
├── .env                  # Environment variables
├── .gitignore           # Git ignore file
├── package.json         # Node.js dependencies
└── README.md            # This file
```

## Memory Management

The application is optimized for RTX 2060 Super (8GB VRAM):
- Model uses Q4_K_M quantization
- GPU layers: 35
- Context size: 2048
- Batch size: 512
- KQV offloading enabled

## Troubleshooting

1. **GPU Memory Issues**
   - Check GPU memory usage with `nvidia-smi`
   - Reduce `n_gpu_layers` if needed
   - Adjust batch size

2. **Python Server Not Starting**
   - Check CUDA installation
   - Verify model file exists
   - Check port 8000 availability

3. **Node.js Connection Issues**
   - Verify Python server is running
   - Check port 8000 accessibility
   - Review network settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 
