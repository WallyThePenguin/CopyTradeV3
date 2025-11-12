import os
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from ics import Calendar
from sqlalchemy import create_engine, text
from uuid import uuid4

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _resolve_database_url(raw_url: str | None) -> str:
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
CALENDAR_URL = os.environ.get(
    "MARKET_CALENDAR_URL",
    "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
)

engine = create_engine(DATABASE_URL)


def fetch_calendar(url: str) -> str:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.text


def parse_events(ics_text: str, source: str):
    cal = Calendar(ics_text)
    for event in cal.events:
        yield {"eventDate": event.begin.datetime, "title": event.name, "source": source}


def save_events(events):
    """Insert parsed events into the database."""
    with engine.begin() as conn:
        for ev in events:
            conn.execute(
                text(
                    'INSERT INTO "MarketCalendar" ("id", "eventDate", "title", "source", "createdAt") '
                    "VALUES (:id, :eventDate, :title, :source, :createdAt) "
                    "ON CONFLICT DO NOTHING"
                ),
                {
                    "id": str(uuid4()),
                    "eventDate": ev["eventDate"],
                    "title": ev["title"],
                    "source": ev["source"],
                    "createdAt": datetime.utcnow(),
                },
            )


def update_market_calendar(url: str = CALENDAR_URL):
    """Fetch and store upcoming market events."""
    ics_text = fetch_calendar(url)
    events = parse_events(ics_text, url)
    save_events(events)


if __name__ == "__main__":
    update_market_calendar()
    print("Calendar updated")
