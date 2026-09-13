"""
FastAPI backend for Capital You (Capital One Challenge -- HackMTY 2026).

Powers:
  1. The React frontend (frontend/) -- account data, fraud risk, spending
     breakdown, leaks (recurring charges), card freeze.
  2. An in-app chat + voice assistant (/chat/message, /chat/speak below --
     assistant.py does the thinking via Google's Gemini API (free tier),
     voice.py turns the reply into real audio via ElevenLabs). There's also
     a standalone demo page for it at /chat, useful for testing without the
     React app running.
  3. Interactive docs at /docs for poking at it manually.

All of the above call the exact same compute_* functions defined below, so
none of these interfaces can ever disagree with each other.

Storage: for the hackathon, account/purchase data comes straight from
Nessie (Capital One's sandbox API) on every request, and the "frozen card"
state lives in a small local JSON file (frozen_store.py) since Nessie has
no real freeze concept. No database wired up yet -- see the README for the
Mongo plan if/when that's needed; this keeps things simple and working
under time pressure.

CORS is wide open for hackathon convenience (matches what was already here)
-- tighten allow_origins before this goes anywhere real.

Run with:
    uvicorn main:app --reload
"""

from collections import defaultdict
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from pydantic import BaseModel
import json
import os

load_dotenv()

from nessie_client import NessieClient, NessieError
from baseline import build_baseline, score_window
import frozen_store

app = FastAPI(title="Capital You API")

# Habilitar CORS para que tu React en localhost:5173 pueda consumir esta API sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En hackathons permitimos todos para evitar problemas de conexión
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = NessieClient()

DEMO_ACCOUNT_FILE = "demo_account.json"

_merchant_category_cache: dict[str, str] = {}


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend FastAPI listo"}


def get_merchant_category(merchant_id: str) -> str:
    if merchant_id not in _merchant_category_cache:
        merchant = client.get(f"/merchants/{merchant_id}")
        category = merchant.get("category")
        if isinstance(category, list):
            category = category[0] if category else "Unknown"
        _merchant_category_cache[merchant_id] = category or "Unknown"
    return _merchant_category_cache[merchant_id]


def purchases_with_category(account_id: str) -> list[dict]:
    """Pull purchases for an account and join in each one's merchant category."""
    raw = client.get_account_purchases(account_id) or []
    enriched = []
    for p in raw:
        category = get_merchant_category(p["merchant_id"])
        enriched.append({**p, "category": category})
    return enriched


def get_demo_account() -> dict:
    """
    The single seeded demo persona. Used by both the HTTP /demo-account
    route and the chat assistant (which doesn't have a "logged in user" --
    for the hackathon, every chat conversation is about this one account.
    Fine for a demo; a real product would map a session/user to a real
    customer record.)
    """
    if not os.path.exists(DEMO_ACCOUNT_FILE):
        raise FileNotFoundError("No demo account yet -- run `python seed_data.py` first.")
    with open(DEMO_ACCOUNT_FILE) as f:
        saved = json.load(f)

    account = client.get_account(saved["account_id"])
    return {
        "customer_id": saved["customer_id"],
        "account_id": saved["account_id"],
        "first_name": saved.get("first_name"),
        "last_name": saved.get("last_name"),
        "nickname": account.get("nickname"),
        "balance": account.get("balance"),
        "mask": saved["account_id"][-4:],
        "frozen": frozen_store.is_frozen(saved["account_id"]),
    }


# ---- shared compute functions: routes below AND assistant.py both call
# these, so the React app and the chat assistant can never disagree ----

def compute_risk(account_id: str, window_size: int = 4) -> dict:
    """
    Naive but functional: treat everything except the last `window_size`
    purchases as the baseline history, and score that final window. Matches
    seed_data.py, which appends exactly a 4-purchase fraud burst at the end
    -- keep window_size=4 unless you change the burst length there too.
    """
    purchases = purchases_with_category(account_id)

    if len(purchases) <= window_size:
        raise ValueError(
            f"Need more than {window_size} purchases to separate "
            f"baseline history from a recent window."
        )

    history, recent = purchases[:-window_size], purchases[-window_size:]
    baseline = build_baseline(history)
    result = score_window(recent, baseline)

    return {
        "account_id": account_id,
        "score": result.score,
        "flagged": result.flagged,
        "unusual_categories": result.distinct_unusual_categories,
        "explanation": result.explanation,
        "sequence": result.sequence,
    }


def compute_spending(account_id: str, window_size: int = 4) -> dict:
    """
    Deliberately excludes the most recent `window_size` purchases (the same
    ones compute_risk is currently scoring) -- an in-flight, not-yet-resolved
    burst shouldn't count as confirmed normal spending.
    """
    purchases = purchases_with_category(account_id)
    settled = purchases[:-window_size] if len(purchases) > window_size else purchases

    totals: dict[str, float] = {}
    for p in settled:
        totals[p["category"]] = totals.get(p["category"], 0) + p.get("amount", 0)

    grand_total = sum(totals.values()) or 1
    return {
        "account_id": account_id,
        "total": round(grand_total, 2),
        "breakdown": [
            {"category": cat, "amount": round(amt, 2),
             "percent": round(100 * amt / grand_total, 1)}
            for cat, amt in sorted(totals.items(), key=lambda kv: -kv[1])
        ],
    }


def compute_leaks(account_id: str, min_occurrences: int = 3, window_size: int = 4) -> dict:
    """Simple recurring-charge detector: same merchant + same amount, seen
    `min_occurrences`+ times reads as a subscription."""
    purchases = purchases_with_category(account_id)
    settled = purchases[:-window_size] if len(purchases) > window_size else purchases

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for p in settled:
        key = (p["merchant_id"], round(p.get("amount", 0), 2))
        groups[key].append(p)

    found = []
    for (merchant_id, amount), items in groups.items():
        if len(items) >= min_occurrences:
            found.append({
                "category": items[0]["category"],
                "amount": amount,
                "count": len(items),
            })

    return {"account_id": account_id, "leaks": found}


# ---- HTTP routes: thin wrappers around the compute_* functions above ----

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/chat", response_class=HTMLResponse)
def chat_page():
    """
    Standalone chat+voice demo page, served from this same backend/origin.
    Handy for testing the assistant without the React app running. You can
    also just open voice-chat-demo.html directly (double-click it) -- mic
    included, that still works too (file:// pages count as a browser
    "secure context"). This route just makes deployment/testing simpler:
    one origin, no CORS to think about, no API base URL to configure.
    """
    with open("voice-chat-demo.html", encoding="utf-8") as f:
        return f.read()


@app.get("/demo-account")
def demo_account():
    try:
        return get_demo_account()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NessieError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/accounts/{account_id}/purchases")
def account_purchases(account_id: str):
    try:
        return purchases_with_category(account_id)
    except NessieError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/accounts/{account_id}/risk")
def account_risk(account_id: str, window_size: int = 4):
    try:
        return compute_risk(account_id, window_size)
    except NessieError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/accounts/{account_id}/spending-breakdown")
def spending_breakdown(account_id: str, window_size: int = 4):
    try:
        return compute_spending(account_id, window_size)
    except NessieError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/accounts/{account_id}/leaks")
def get_leaks(account_id: str, min_occurrences: int = 3, window_size: int = 4):
    try:
        return compute_leaks(account_id, min_occurrences, window_size)
    except NessieError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/accounts/{account_id}/freeze")
def freeze_account(account_id: str, frozen: bool = True):
    """Simulated freeze -- see frozen_store.py. Also reachable from the
    chat assistant via the same underlying function."""
    frozen_store.set_frozen(account_id, frozen)
    return {"account_id": account_id, "frozen": frozen}


# ---- in-app chat + voice ----

class ChatMessageIn(BaseModel):
    message: str


class ChatSpeakIn(BaseModel):
    text: str


@app.post("/chat/message")
def chat_message(body: ChatMessageIn):
    """One turn of the assistant: runs assistant.py's Gemini tool-use loop
    and returns plain text. The frontend calls /chat/speak separately with
    that text to get real audio -- kept as two calls so the text bubble can
    appear immediately while the audio finishes a moment later."""
    try:
        reply = assistant.run_agent_turn(body.message)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"reply": reply}


@app.post("/chat/speak")
def chat_speak(body: ChatSpeakIn):
    """Turns `text` into real spoken audio via ElevenLabs. Returns raw MP3
    bytes -- the frontend plays them directly, no base64 round trip."""
    try:
        audio = voice.synthesize_speech(body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except voice.ElevenLabsError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return Response(content=audio, media_type="audio/mpeg")


# ---- shared assistant brain + voice, imported down here on purpose: both
# modules import functions defined above (compute_risk, get_demo_account,
# etc.) via `import main as backend`, so this has to come after those are
# defined. The /chat/* routes above reference `assistant`/`voice` even
# though they're defined earlier in the file -- that's fine, Python looks
# up module-level names at call time, not at def time, and by the time a
# real HTTP request comes in this import has already finished. ----
try:
    import assistant
    import voice
except ImportError as e:
    print(f"Assistant/voice not available (missing dependency?): {e}")
