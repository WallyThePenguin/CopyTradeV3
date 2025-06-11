# CopyTradeV2: AI-Powered Trading Message Analysis

## Overview

CopyTradeV2 is an advanced trading message analysis backend that combines:
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
- **Error Handling**: All errors are logged and sent to the webhook.
- **Extensible**: Add more regex patterns, examples, or context as needed.

## Setup

1. **Clone the repo**
2. **Install dependencies** (Python 3.10+, FastAPI, llama-cpp-python, requests, etc)
3. **Set environment variables**:
   - `WEBHOOK_URL` (your endpoint to receive analysis results)
4. **Configure your model path and GPU settings** in `mistral_server.py` (see `initialize_model`)
5. **Run the server**:
   ```bash
   uvicorn mistral_server:app --host 0.0.0.0 --port 8000
   ```

## API Usage

- **POST /analyze**
  - Request: `{ "content": "QQQ 515 P" }`
  - Response: JSON with trade signal info, confidence, and timing
  - Webhook: Same JSON is POSTed to your `WEBHOOK_URL`

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
