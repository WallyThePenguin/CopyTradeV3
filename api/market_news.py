import os
import json
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from uuid import uuid4

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _resolve_database_url(raw_url: str | None) -> str:
    """Convert Prisma-style file: paths into SQLAlchemy SQLite URLs."""
    if not raw_url:
        raw_url = "file:./data/dev.db"
    normalized = raw_url.strip().strip('"').strip("'")
    if normalized.startswith("file:"):
        db_path = Path(normalized.replace("file:", "", 1))
        if not db_path.is_absolute():
            db_path = (BASE_DIR / db_path).resolve()
        return f"sqlite:///{db_path.as_posix()}"
    return normalized


DATABASE_URL = _resolve_database_url(os.environ.get("DATABASE_URL"))
NEWS_FEED_PATH = os.environ.get("NEWS_FEED_PATH", "data/news/sample_news.json")

engine = create_engine(DATABASE_URL)


def fetch_news(path: str = NEWS_FEED_PATH):
    """Return a list of news items from a file or HTTP endpoint."""
    if path.startswith("http://") or path.startswith("https://"):
        resp = requests.get(path, timeout=10)
        resp.raise_for_status()
        return resp.json()
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_updates(items):
    with engine.begin() as conn:
        for item in items:
            conn.execute(
                text(
                    'INSERT INTO "MarketUpdate" ("id","channelId","messageId","summary","sentiment","symbol","createdAt") '
                    'VALUES (:id, :channelId, :messageId, :summary, :sentiment, :symbol, :createdAt) '
                    'ON CONFLICT ("messageId") DO NOTHING'
                ),
                {
                    "id": str(uuid4()),
                    "channelId": item.get("channelId", "news"),
                    "messageId": item["messageId"],
                    "summary": item["summary"],
                    "sentiment": item.get("sentiment", "NEUTRAL"),
                    "symbol": item.get("symbol"),
                    "createdAt": item.get("createdAt", datetime.utcnow()),
                },
            )


def update_market_news(path: str = NEWS_FEED_PATH):
    news_items = fetch_news(path)
    save_updates(news_items)


if __name__ == "__main__":
    update_market_news()
    print("Market news updated")

