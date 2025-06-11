from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from llama_cpp import Llama
import torch
import gc
import os
from typing import Optional, Dict, Any
import logging
from utils.gpu import clear_gpu_memory, get_gpu_info, optimize_for_rtx2060
from analysis.channel_analyzer import ChannelAnalyzer
import threading
import schedule
import time
import re
import json
import requests
from collections import defaultdict
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Global instances
model = None
channel_analyzer = None
trade_context = None
current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, "..", "model",
                          "mistral-7b-instruct-v0.2.Q4_K_M.gguf")
model_path = os.path.abspath(model_path)  # Normalize the path

# Trade context tracking


class TradeContext:
    def __init__(self):
        # ticker -> {strike: trade_info}
        self.active_trades = defaultdict(dict)
        self.last_trade = None  # Last trade info for context
        self.history_file = "data/logs/trade_history.json"
        self.load_history()

    def load_history(self):
        """Load trade history from file"""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    self.trade_history = json.load(f)
            except json.JSONDecodeError:
                self.trade_history = []
        else:
            self.trade_history = []

    def save_history(self):
        """Save trade history to file"""
        os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        with open(self.history_file, 'w') as f:
            json.dump(self.trade_history, f, indent=2)

    def add_trade(self, ticker, trade_info):
        if 'strikePrice' in trade_info:
            self.active_trades[ticker][trade_info['strikePrice']] = trade_info
        self.last_trade = trade_info

        # Add to history with timestamp
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": "open",
            "trade_info": trade_info
        }
        self.trade_history.append(history_entry)
        self.save_history()

    def get_trade(self, ticker, strike_price=None):
        if strike_price:
            return self.active_trades[ticker].get(strike_price)
        return self.last_trade

    def close_trade(self, ticker, strike_price=None):
        if strike_price:
            trade = self.active_trades[ticker].pop(strike_price, None)
            if trade:
                # Add to history with timestamp
                history_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "action": "close",
                    "trade_info": trade
                }
                self.trade_history.append(history_entry)
                self.save_history()
            return trade
        return None

    def get_recent_trades(self, count=5):
        """Get the most recent trades for context"""
        return self.trade_history[-count:] if self.trade_history else []


# --- Regex patterns for buy/sell detection, including abbreviations and Gen Z slang ---
SELL_PATTERNS = [
    r'\bim\s+out\b', r'\bout\b', r'\bexit\b', r'\bclose\b', r'\bdone\b',
    r'\btaking\s+profit\b', r'\bcutting\s+loss\b', r'\bstopping\s+out\b',
    r'\bclosing\s+position\b', r'\bselling\b', r'\bsold\b', r'\bsell\b',
    r'\bsell\s+now\b', r'\bselling\s+now\b', r'\btake\s+profit\b', r'\btaking\s+profits\b',
    r'\bexit\s+now\b', r'\bget\s+out\b', r'\bgetting\s+out\b', r'\bclose\s+now\b', r'\bclosing\s+now\b',
    r'\bunload\b', r'\bunloading\b', r'\bdump\b', r'\bdumping\b', r'\bcash\s+out\b', r'\bcashing\s+out\b',
    r'\bsecure\s+profit\b', r'\bsecuring\s+profit\b', r'\bsecure\s+gains\b', r'\bsecuring\s+gains\b',
    r'\bgood\s+job\b.*\bsell\b', r'\bnice\s+work\b.*\bsell\b', r'\bperfect\b.*\bsell\b', r'\bexcellent\b.*\bsell\b',
    r'\bnice\s+work\b', r'\bgood\s+job\b', r'\bperfect\b', r'\bexcellent\b',
    r'\bselling\s*\.{3}\b', r'\bsell\s*\.{3}\b', r'\bgo\s+go\s+go\s+sell\b', r'\bgo\s+go\s+go\s+selling\b',
    r'\bgo\s+go\s+go\b.*\bsell\b', r'\bgo\s+go\s+go\b.*\bselling\b',
    # Abbreviations and slang
    r'\bpt\b', r'\bprofit\b', r'\bsecure\b', r'\bcashed\b', r'\bexited\b', r'\bexiting\b',
    r'\bgg\b', r'\bbye\b', r'\bpeace\b', r'\bfin\b', r'\bdumped\b', r'\bflipped\b', r'\bflipping\b',
    r'\bpaper\s+hands\b', r'\bclosing\s+trade\b', r'\bclosing\s+out\b', r'\bbagged\b', r'\bbagging\b',
    r'\b🤑\b', r'\b💰\b', r'\b🚀\b', r'\b💸\b', r'\b🛑\b', r'\b🔴\b', r'\b🧑‍💻\b'
]
BUY_PATTERNS = [
    r'\bbuy\b', r'\bbuying\b', r'\badd\b', r'\badding\b', r'\bload\b', r'\bloading\b',
    r'\bgo\s+long\b', r'\bopen\b', r'\bopening\b', r'\bstart\b', r'\bstarting\b',
    r'\benter\b', r'\bentry\b', r'\bgetting\s+in\b', r'\bget\s+in\b', r'\binitiate\b', r'\binitiating\b',
    r'\bscale\s+in\b', r'\bscaling\s+in\b', r'\badd\s+to\s+position\b', r'\baveraging\s+down\b',
    r'\baveraging\s+in\b', r'\baccumulate\b', r'\baccumulating\b', r'\bbuild\b', r'\bbuilding\b',
    # Abbreviations and slang
    r'\blong\b', r'\bmoon\b', r'\bmooning\b', r'\bape\b', r'\baping\b', r'\bdiamond\s+hands\b',
    r'\b🚀\b', r'\b💎\b', r'\b🟢\b', r'\bgreen\b', r'\bcall\b', r'\bcalls\b', r'\b🟩\b', r'\b🟢\b'
]

# Check for partial exit patterns
PARTIAL_PATTERNS = [
    r'\bhalf\b',
    r'\bpartial\b',
    r'\bsome\b',
    r'\bportion\b',
    r'\bamount\b'
]

# Comprehensive examples from old code
EXAMPLES = [
    {
        "input": """Levels to watch 📈📉\n\nBullish breakout:\nOver 583.75 → 584.50 → 585.00\n\nBearish breakdown:\nUnder 581.28 → 580.55 → 580.00""",
        "output": {
            "action": "none",
            "type": "levels",
            "ticker": "SPY",
            "bullish_levels": [583.75, 584.50, 585.00],
            "bearish_levels": [581.28, 580.55, 580.00],
            "confidence": 0.95,
            "reasoning": "Price levels for potential breakouts/breakdowns"
        }
    },
    {
        "input": "SPY 582 P",
        "output": {
            "action": "open",
            "type": "option",
            "ticker": "SPY",
            "option_type": "PUT",
            "strike_price": 582,
            "confidence": 0.95,
            "reasoning": "Opening PUT position with market order"
        }
    },
    {
        "input": "SPY $582 C @1.00",
        "output": {
            "action": "open",
            "type": "option",
            "ticker": "SPY",
            "option_type": "CALL",
            "strike_price": 582,
            "confidence": 0.95,
            "reasoning": "Opening CALL position with market order (reference price: 1.00)"
        }
    },
    {
        "input": "I'm out",
        "output": {
            "action": "close",
            "type": "option",
            "ticker": "SPY",
            "option_type": "PUT",
            "strike_price": 582,
            "entry_price": 1.00,
            "exit_price": 1.95,
            "profit_percent": 95,
            "confidence": 0.95,
            "reasoning": "Full position close with profit"
        }
    }
]


def is_exit_signal(message_content):
    """Enhanced exit signal detector with partial exit detection"""
    message = message_content.lower()

    # Check if it's an exit signal
    is_exit = any(re.search(pattern, message) for pattern in SELL_PATTERNS)
    if not is_exit:
        return None

    # Check if it's a partial exit
    is_partial = any(re.search(pattern, message)
                     for pattern in PARTIAL_PATTERNS)

    return {
        "is_exit": True,
        "exit_type": "partial" if is_partial else "full",
        "confidence": 0.95,
        "reasoning": "Exit signal detected" + (" (partial)" if is_partial else "")
    }


def get_enhanced_prompt(message_content, trade_context):
    """Get optimized prompt for Mistral with trade context"""
    # Get active trades for context
    active_trades = []
    for ticker, trades in trade_context.active_trades.items():
        for strike, trade in trades.items():
            active_trades.append(
                f"{ticker} {strike} {trade.get('optionType', '')} @{trade.get('entryPrice', '')}")

    # Get recent trade history
    recent_trades = trade_context.get_recent_trades(3)  # Last 3 trades
    history_str = "\n".join([
        f"{trade['action']}: {trade['trade_info'].get('symbol', '')} {trade['trade_info'].get('strikePrice', '')} {trade['trade_info'].get('optionType', '')} @{trade['trade_info'].get('entryPrice', '')}"
        for trade in recent_trades
    ]) if recent_trades else "No recent trades"

    context_str = "\n".join(
        active_trades) if active_trades else "No active trades"

    return f"""[INST] You are a trading message analyzer. Extract trade information into JSON format.

ACTIVE TRADES:
{context_str}

RECENT TRADE HISTORY:
{history_str}

REQUIRED OUTPUT STRUCTURE:
{{
    "action": string,  // "open", "close", or "none"
    "type": string,    // "option", "stock", or "levels"
    "ticker": string,  // Stock symbol
    "confidence": float,  // 0-1 confidence score
    "reasoning": string,  // Clear explanation of the analysis
}}

ACTION-SPECIFIC FIELDS:
1. For "open":
   - option_type: string (if applicable)
   - strike_price: float (if applicable)
   - price: float (optional, for reference only - all orders are market orders)

2. For "close":
   - entry_price: float (from active trade)
   - exit_price: float (if mentioned)
   - profit_percent: float (if both prices available)
   - option_type: string (from active trade)
   - strike_price: float (from active trade)

3. For "levels":
   - bullish_levels: array of floats
   - bearish_levels: array of floats

RULES:
1. For "im out" or similar messages, use the active trade details
2. Include all trade details from active trades
3. Return empty object {{}} if no trade is detected
4. Reference recent trade history for context
5. Handle these formats:
   - "TICKER STRIKE OPTION_TYPE" (e.g., "SPY 550 PUT", "QQQ 400 CALL")
   - "TICKER STRIKE OPTION_TYPE @PRICE" (e.g., "SPY 590 PUT @0.57", "QQQ 450 CALL @1.20")
   - "TICKER $STRIKE OPTION_TYPE" (e.g., "SPY $550 PUT", "QQQ $400 CALL")
   - "TICKER $STRIKE OPTION_TYPE @PRICE" (e.g., "SPY $590 PUT @0.57", "QQQ $450 CALL @1.20")
   - "TICKER STRIKE C" (e.g., "SPY 550 C", "QQQ 400 C")
   - "TICKER STRIKE P" (e.g., "SPY 550 P", "QQQ 400 P")
   - "TICKER $STRIKE C" (e.g., "SPY $550 C", "QQQ $400 C")
   - "TICKER $STRIKE P" (e.g., "SPY $550 P", "QQQ $400 P")
6. Always process as market orders, even if price is provided
7. If price is provided, include it for reference only
8. Convert option abbreviations:
   - "C" or "CALL" → "CALL"
   - "P" or "PUT" → "PUT"
9. Support ANY valid ticker symbol (SPY, QQQ, AAPL, etc.)
10. Support ANY valid strike price
11. Support ANY valid option type (CALL/PUT)

EXAMPLES:

Input: "{EXAMPLES[0]['input']}"
Output: {json.dumps(EXAMPLES[0]['output'], indent=2)}

Input: "{EXAMPLES[1]['input']}"
Output: {json.dumps(EXAMPLES[1]['output'], indent=2)}

Input: "{EXAMPLES[2]['input']}"
Output: {json.dumps(EXAMPLES[2]['output'], indent=2)}

Input: "{EXAMPLES[3]['input']}"
Output: {json.dumps(EXAMPLES[3]['output'], indent=2)}

Now analyze this message:
{message_content}

Return only the JSON object, nothing else. If no trade is detected, return an empty object {{}}. [/INST]"""


class MessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    isTradeSignal: bool
    symbol: Optional[str] = None
    action: Optional[str] = None
    optionType: Optional[str] = None
    strikePrice: Optional[float] = None
    entryPrice: Optional[float] = None
    confidence: float = 0.0
    signalType: Optional[str] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None


def initialize_model():
    """Initialize the Mistral model with GPU optimization for RTX 2060 Super"""
    global model

    # Clear GPU memory
    clear_gpu_memory()

    try:
        # Get optimal settings for RTX 2060 Super
        settings = optimize_for_rtx2060()

        model = Llama(
            model_path=model_path,
            **settings,
            chat_format="mistral-instruct",
            verbose=False
        )
        logger.info("Model initialized successfully")
        logger.info(f"GPU Info: {get_gpu_info()}")
    except Exception as e:
        logger.error(f"Error initializing model: {str(e)}")
        raise


def initialize_channel_analyzer():
    """Initialize the channel analyzer"""
    global channel_analyzer
    try:
        channel_analyzer = ChannelAnalyzer()
        logger.info("Channel analyzer initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing channel analyzer: {str(e)}")
        raise


def run_channel_analysis():
    """Run channel analysis in a separate thread"""
    if channel_analyzer:
        try:
            channel_analyzer.analyze_all_channels()
        except Exception as e:
            logger.error(f"Error running channel analysis: {str(e)}")


def schedule_analysis():
    """Schedule periodic channel analysis"""
    schedule.every().day.at("00:00").do(run_channel_analysis)

    while True:
        schedule.run_pending()
        time.sleep(60)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global trade_context

    # Initialize Mistral model
    initialize_model()

    # Initialize trade context
    trade_context = TradeContext()
    logger.info("Trade context initialized")

    # Initialize channel analyzer
    initialize_channel_analyzer()

    # Start analysis scheduler in a separate thread
    analysis_thread = threading.Thread(target=schedule_analysis, daemon=True)
    analysis_thread.start()

    # Run initial analysis
    run_channel_analysis()


def regex_maybe_action(message, patterns):
    message = message.lower()
    return any(re.search(pattern, message) for pattern in patterns)


def get_action_confirmation_prompt(message, action):
    # Use examples in the prompt for better LLM accuracy
    example_str = "\n".join([
        f"Input: {ex['input']}\nOutput: {json.dumps(ex['output'])}" for ex in EXAMPLES
    ])
    return f'''[INST] The following message was flagged as a potential {action} by a keyword filter. Does it actually indicate a {action} action? Only answer with a JSON object: {{"is_{action}": true/false, "reason": "..."}}

EXAMPLES:
{example_str}

Message: "{message}"

Return only the JSON object. If not a {action} signal, return false. [/INST]'''


@app.post("/analyze", response_model=MessageResponse)
async def analyze_message(request: MessageRequest) -> dict:
    start_time = time.time()
    msg = request.content
    logger.info(f"Received message for analysis: {msg}")
    webhook_url = os.environ.get("WEBHOOK_URL")

    try:
        # First check if it's an exit signal using enhanced detection
        exit_result = is_exit_signal(msg)

        # If it's an exit signal, use the active trade details
        if exit_result and exit_result.get('is_exit', False):
            # Get the last active trade
            last_trade = trade_context.last_trade
            if last_trade:
                # Close the trade
                closed_trade = trade_context.close_trade(
                    last_trade.get('symbol'),
                    last_trade.get('strikePrice')
                )

                processing_time = time.time() - start_time
                logger.info(
                    f"Confirmed {exit_result['exit_type']} exit in {round(processing_time, 3)}s")

                response_dict = {
                    "isTradeSignal": True,
                    "symbol": last_trade.get('symbol'),
                    "action": "SELL",
                    "optionType": last_trade.get('optionType'),
                    "strikePrice": last_trade.get('strikePrice'),
                    "entryPrice": last_trade.get('entryPrice'),
                    "confidence": exit_result['confidence'],
                    "processing_time": round(processing_time, 3),
                    "signalType": "EXIT",
                    "error": None,
                    "reason": f"{exit_result['reasoning']} - {exit_result['exit_type']} exit"
                }
                send_webhook(response_dict, webhook_url)
                return response_dict

        # Step 1: Regex pre-filter for sell (backup check)
        if regex_maybe_action(msg, SELL_PATTERNS):
            t_llm = time.time()
            prompt = get_action_confirmation_prompt(msg, "exit")
            response = model(
                prompt,
                max_tokens=64,
                temperature=0.1,
                top_p=0.95,
                top_k=40,
                repeat_penalty=1.1,
                stop=["</s>", "Human:", "Assistant:", "[INST]"],
                echo=False
            )
            t_llm_done = time.time()
            logger.info(
                f"Sell LLM confirmation time: {round(t_llm_done - t_llm, 3)}s")

            try:
                result = json.loads(response['choices'][0]['text'].strip())
                if result.get("is_exit") is True:
                    processing_time = time.time() - start_time
                    logger.info(
                        f"Confirmed sell/exit in {round(processing_time, 3)}s")

                    # Use last trade info if available
                    last_trade = trade_context.last_trade or {}
                    response_dict = {
                        "isTradeSignal": True,
                        "symbol": last_trade.get('symbol'),
                        "action": "SELL",
                        "optionType": last_trade.get('optionType'),
                        "strikePrice": last_trade.get('strikePrice'),
                        "entryPrice": last_trade.get('entryPrice'),
                        "confidence": 0.95,
                        "processing_time": round(processing_time, 3),
                        "signalType": "EXIT",
                        "error": None,
                        "reason": result.get("reason", "LLM confirmed exit signal")
                    }
                    send_webhook(response_dict, webhook_url)
                    return response_dict
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse exit confirmation response")

        # Step 2: Regex pre-filter for buy
        if regex_maybe_action(msg, BUY_PATTERNS):
            t_llm = time.time()
            prompt = get_action_confirmation_prompt(msg, "buy")
            response = model(
                prompt,
                max_tokens=64,
                temperature=0.1,
                top_p=0.95,
                top_k=40,
                repeat_penalty=1.1,
                stop=["</s>", "Human:", "Assistant:", "[INST]"],
                echo=False
            )
            t_llm_done = time.time()
            logger.info(
                f"Buy LLM confirmation time: {round(t_llm_done - t_llm, 3)}s")

            try:
                result = json.loads(response['choices'][0]['text'].strip())
                if result.get("is_buy") is True:
                    processing_time = time.time() - start_time
                    logger.info(
                        f"Confirmed buy in {round(processing_time, 3)}s")
                    response_dict = {
                        "isTradeSignal": True,
                        "action": "BUY",
                        "confidence": 0.95,
                        "processing_time": round(processing_time, 3),
                        "signalType": "ENTRY",
                        "error": None,
                        "reason": result.get("reason", "LLM confirmed buy signal")
                    }
                    send_webhook(response_dict, webhook_url)
                    return response_dict
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse buy confirmation response")

        # Step 3: Full LLM analysis if not confirmed by above
        t_full = time.time()
        # Use enhanced context-rich prompt for full analysis
        prompt = get_enhanced_prompt(msg, trade_context)
        response = model(
            prompt,
            max_tokens=512,
            temperature=0.1,
            top_p=0.95,
            top_k=40,
            repeat_penalty=1.1,
            stop=["</s>", "Human:", "Assistant:", "[INST]"],
            echo=False
        )
        t_full_done = time.time()
        logger.info(
            f"Full LLM analysis time: {round(t_full_done - t_full, 3)}s")

        try:
            result = json.loads(response['choices'][0]['text'].strip())
            processing_time = time.time() - start_time

            # Map the internal format to the API response format
            if result.get('action') == 'open' and result.get('type') == 'option':
                # Add to trade context
                trade_info = {
                    'symbol': result.get('ticker'),
                    'optionType': result.get('option_type'),
                    'strikePrice': result.get('strike_price'),
                    'entryPrice': result.get('price'),
                    'confidence': result.get('confidence', 0.95)
                }
                trade_context.add_trade(result.get('ticker'), trade_info)

                response_dict = {
                    "isTradeSignal": True,
                    "symbol": result.get('ticker'),
                    "action": "BUY",
                    "optionType": result.get('option_type'),
                    "strikePrice": result.get('strike_price'),
                    "entryPrice": result.get('price'),
                    "confidence": result.get('confidence', 0.95),
                    "processing_time": round(processing_time, 3),
                    "signalType": "ENTRY",
                    "error": None
                }
            elif result.get('action') == 'close':
                # Close trade in context
                closed_trade = trade_context.close_trade(
                    result.get('ticker'),
                    result.get('strike_price')
                )

                response_dict = {
                    "isTradeSignal": True,
                    "symbol": result.get('ticker'),
                    "action": "SELL",
                    "optionType": result.get('option_type'),
                    "strikePrice": result.get('strike_price'),
                    "entryPrice": result.get('entry_price'),
                    "confidence": result.get('confidence', 0.95),
                    "processing_time": round(processing_time, 3),
                    "signalType": "EXIT",
                    "error": None
                }
            else:
                # Not a trade signal
                response_dict = {
                    "isTradeSignal": False,
                    "symbol": None,
                    "action": None,
                    "optionType": None,
                    "strikePrice": None,
                    "entryPrice": None,
                    "confidence": 0.0,
                    "signalType": None,
                    "processing_time": round(processing_time, 3),
                    "error": None
                }

            logger.info(
                f"Analysis completed in {response_dict['processing_time']} seconds")
            send_webhook(response_dict, webhook_url)
            return response_dict

        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse LLM response: {response['choices'][0]['text'].strip()}")
            error_response = {
                "isTradeSignal": False,
                "symbol": None,
                "action": None,
                "optionType": None,
                "strikePrice": None,
                "entryPrice": None,
                "confidence": 0.0,
                "signalType": None,
                "error": f"JSON parsing error: {str(e)}",
                "processing_time": round(time.time() - start_time, 3)
            }
            logger.info(
                f"Error response sent in {error_response['processing_time']} seconds")
            send_webhook(error_response, webhook_url)
            return error_response

    except Exception as e:
        logger.error(f"Error analyzing message: {str(e)}")
        error_response = {
            "isTradeSignal": False,
            "symbol": None,
            "action": None,
            "optionType": None,
            "strikePrice": None,
            "entryPrice": None,
            "confidence": 0.0,
            "signalType": None,
            "error": str(e),
            "processing_time": round(time.time() - start_time, 3)
        }
        logger.info(
            f"Error response sent in {error_response['processing_time']} seconds")
        send_webhook(error_response, webhook_url)
        return error_response


def send_webhook(data, webhook_url):
    if webhook_url:
        try:
            resp = requests.post(webhook_url, json=data, timeout=5)
            logger.info(f"Webhook sent: {resp.status_code}")
        except Exception as e:
            logger.error(f"Error sending webhook: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "gpu_info": get_gpu_info(),
        "channel_analyzer": "initialized" if channel_analyzer else "not_initialized"
    }


@app.get("/trade-history")
async def get_trade_history():
    """Get trade history and active trades"""
    if not trade_context:
        raise HTTPException(
            status_code=503, detail="Trade context not initialized")

    active_trades = {}
    for ticker, trades in trade_context.active_trades.items():
        active_trades[ticker] = list(trades.values())

    return {
        "active_trades": active_trades,
        "last_trade": trade_context.last_trade,
        "recent_history": trade_context.get_recent_trades(10),
        "total_trades": len(trade_context.trade_history)
    }

if __name__ == "__main__":
    # Create necessary directories
    os.makedirs('data/logs', exist_ok=True)

    # Run the FastAPI server
    uvicorn.run(
        "mistral_server:app",
        host="127.0.0.1",
        port=8000,
        reload=False  # Disable reload to prevent multiple model instances
    )
