import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text
import requests

DATABASE_URL = os.environ.get("DATABASE_URL")
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
                    'VALUES (gen_random_uuid(), :channelId, :messageId, :summary, :sentiment, :symbol, :createdAt) '
                    'ON CONFLICT ("messageId") DO NOTHING'
                ),
                {
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

