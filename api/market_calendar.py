import requests
from datetime import datetime
from ics import Calendar
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")
CALENDAR_URL = os.environ.get("MARKET_CALENDAR_URL", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm")

engine = create_engine(DATABASE_URL)

def fetch_calendar(url: str) -> str:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.text

def parse_events(ics_text: str, source: str):
    cal = Calendar(ics_text)
    for event in cal.events:
        yield {
            "eventDate": event.begin.datetime,
            "title": event.name,
            "source": source
        }

def save_events(events):
    with engine.begin() as conn:
        for ev in events:
            conn.execute(
                text(
                    "INSERT INTO \"MarketCalendar\" (\"id\", \"eventDate\", \"title\", \"source\", \"createdAt\") VALUES (gen_random_uuid(), :eventDate, :title, :source, now()) ON CONFLICT DO NOTHING"
                ),
                **ev
            )

if __name__ == "__main__":
    ics_text = fetch_calendar(CALENDAR_URL)
    events = parse_events(ics_text, CALENDAR_URL)
    save_events(events)
    print("Calendar updated")
