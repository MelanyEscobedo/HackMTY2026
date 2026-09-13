"""
FastAPI backend for Capital You (Capital One Challenge -- HackMTY 2026).

This file merges two things built in parallel by the team:

  1. The fraud-detection + assistant side (Melany): Nessie account/purchase
     data via nessie_client.py, a category-hopping fraud detection engine
     (baseline.py), simulated card freeze (frozen_store.py), and an in-app
     chat + voice assistant (/chat/message, /chat/speak -- assistant.py does
     the thinking via Gemini tool-use, voice.py turns the reply into real
     audio via ElevenLabs). There's also a standalone demo page for it at
     GET /chat, and a bare-HTML dashboard (balance, fraud alerts, spending,
     recurring charges) at GET /dashboard -- both useful for testing/demoing
     without the React app running.
  2. A broader Nessie CRUD proxy + a simpler multi-turn chat endpoint
     (Yuko): list/create/delete accounts, customers, deposits, withdrawals,
     transfers, bills, plus POST /chat for freeform conversation via
     gemini.py. Lives in nessie.py / gemini.py, separate modules from (1)
     on purpose so neither side steps on the other's error types.

All of (1)'s HTTP routes call the exact same compute_* functions defined
below, so none of those interfaces can ever disagree with each other.

Storage: for the hackathon, account/purchase data comes straight from
Nessie on every request, and the "frozen card" state lives in a small local
JSON file (frozen_store.py) since Nessie has no real freeze concept. No
database wired up yet -- see the README for the Mongo plan if/when that's
needed; this keeps things simple and working under time pressure.

CORS is wide open for hackathon convenience -- tighten allow_origins before
this goes anywhere real.

Run with:
    uvicorn main:app --reload
"""

from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import json
import os

load_dotenv()

from nessie_client import NessieClient, NessieError
from baseline import build_baseline, score_window
import frozen_store
import nessie
import gemini

app = FastAPI(title="Capital You API", description="Proxy al Capital One Nessie API")

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

_merchant_cache: dict[str, dict] = {}


@app.get("/")
def read_root():
    return {
        "status": "ok",
        "message": "Backend FastAPI listo",
        "nessie": bool(os.environ.get("NESSIE_API_KEY")),
    }


def get_merchant_info(merchant_id: str) -> dict:
    """Look up a merchant's name + category, cached so repeat purchases at
    the same merchant only cost one Nessie call. Returns
    {"name": ..., "category": ...}."""
    if merchant_id not in _merchant_cache:
        merchant = client.get(f"/merchants/{merchant_id}")
        category = merchant.get("category")
        if isinstance(category, list):
            category = category[0] if category else "Unknown"
        _merchant_cache[merchant_id] = {
            "name": merchant.get("name") or "Unknown merchant",
            "category": category or "Unknown",
        }
    return _merchant_cache[merchant_id]


def get_merchant_category(merchant_id: str) -> str:
    """Category-only lookup, kept around in case something only needs that."""
    return get_merchant_info(merchant_id)["category"]


def purchases_with_category(account_id: str) -> list[dict]:
    """Pull purchases for an account and join in each one's merchant name +
    category -- used for the fraud/spending math below AND for the
    dashboard's "Recent transactions" list, so both read from one place."""
    raw = client.get_account_purchases(account_id) or []
    enriched = []
    for p in raw:
        info = get_merchant_info(p["merchant_id"])
        enriched.append({**p, "category": info["category"], "merchant_name": info["name"]})
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


@app.get("/login", response_class=HTMLResponse)
def login_page():
    """
    Cosmetic login screen -- Nessie has no concept of a logged-in user (no
    usernames/passwords, just simulated banking data), so this doesn't check
    credentials against anything real. Any input "works" and lands on
    /dashboard. Good enough to make the demo feel like a real app's entry
    point without pretending to have security it doesn't have.
    """
    with open("login.html", encoding="utf-8") as f:
        return f.read()


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page():
    """
    Visual dashboard: balance, fraud alerts (risk gauge + category-hop
    trail), spending breakdown, recurring-charge ("leak") detection, plus
    working "This was me" / "Freeze card" buttons wired to the same
    /accounts/{id}/freeze endpoint the chat assistant uses. Pure HTML/CSS/JS,
    no build step -- calls the same JSON routes below, so it can't drift
    from what the React app (frontend/) shows once that's ready. Falls back
    to static sample data on its own if this backend isn't running.
    """
    with open("dashboard.html", encoding="utf-8") as f:
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
    """Purchases for an account, each enriched with its merchant name +
    category -- used internally by /risk, /spending-breakdown and /leaks
    below, AND by the dashboard's "Recent transactions" list, so this stays
    the one canonical purchases route (the raw, non-enriched version that
    used to live in nessie.py's proxy routes was dropped in the merge to
    avoid two routes fighting over the same path -- everything this one
    returns, that one also returned, plus the name and category)."""
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


# ---- in-app chat + voice (tool-use assistant scoped to the demo account) ----

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


# ------------------------------------------------------------------------
# ---- Nessie CRUD proxy + freeform multi-turn chat (Yuko) ----
#
# Separate from everything above on purpose: nessie.py / gemini.py are their
# own modules with their own NessieError/GeminiError classes, referenced
# here as `nessie.NessieError` / `gemini.GeminiError` (fully qualified) so
# they never get confused with nessie_client.py's NessieError used above.
# ------------------------------------------------------------------------

def _handle(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except nessie.NessieError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


class CustomerPayload(BaseModel):
    first_name: str
    last_name: str
    address: dict


class AccountPayload(BaseModel):
    type: str  # "Checking" | "Savings" | "Credit Card"
    nickname: str
    rewards: int = Field(0, ge=0)
    balance: int = Field(0, ge=0)


class MoneyPayload(BaseModel):
    medium: str = "balance"
    transaction_date: str
    status: str = "pending"
    amount: int
    description: str = ""


class TransferPayload(MoneyPayload):
    payee_id: str


class BillPayload(BaseModel):
    status: str
    payee: str
    nickname: str
    creation_date: str
    payment_date: str
    recurring_date: int
    payment_amount: int


class ChatMessage(BaseModel):
    role: str  # "user" | "model"
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


SYSTEM_PROMPT = (
    "Eres 'Capital You', un asistente financiero ejecutivo de la demo de HackMTY "
    "para Capital One. Responde de forma clara, concisa y profesional en el idioma "
    "del usuario. Ayudas con temas de finanzas personales, cuentas, tarjetas y "
    "ahorros usando datos de cuentas ficticias de Capital One."
)


# ------------------------- Lectura -------------------------

@app.get("/accounts")
def list_accounts():
    return _handle(nessie.get_accounts)


@app.get("/accounts/{account_id}")
def account_detail(account_id: str):
    return _handle(nessie.get_account, account_id)


@app.get("/customers")
def list_customers():
    return _handle(nessie.get_customers)


@app.get("/customers/{customer_id}")
def customer_detail(customer_id: str):
    return _handle(nessie.get_customer, customer_id)


@app.get("/customers/{customer_id}/accounts")
def customer_accounts(customer_id: str):
    return _handle(nessie.get_customer_accounts, customer_id)


@app.get("/accounts/{account_id}/transactions")
def transactions(account_id: str, request: Request):
    params = dict(request.query_params)
    return _handle(nessie.get_transactions, account_id, **params)


@app.get("/accounts/{account_id}/deposits")
def deposits(account_id: str):
    return _handle(nessie.get_deposits, account_id)


@app.get("/accounts/{account_id}/withdrawals")
def withdrawals(account_id: str):
    return _handle(nessie.get_withdrawals, account_id)


@app.get("/accounts/{account_id}/transfers")
def transfers(account_id: str):
    return _handle(nessie.get_transfers, account_id)


@app.get("/accounts/{account_id}/bills")
def bills(account_id: str):
    return _handle(nessie.get_bills, account_id)


# ------------------------- Escritura -------------------------

@app.post("/customers")
def create_customer(payload: CustomerPayload):
    return _handle(nessie.create_customer, payload.model_dump())


@app.post("/customers/{customer_id}/accounts")
def create_account(customer_id: str, payload: AccountPayload):
    return _handle(nessie.create_account, customer_id, payload.model_dump())


@app.post("/accounts/{account_id}/deposits")
def deposit(account_id: str, payload: MoneyPayload):
    return _handle(nessie.deposit, account_id, payload.model_dump())


@app.post("/accounts/{account_id}/withdrawals")
def withdraw(account_id: str, payload: MoneyPayload):
    return _handle(nessie.withdraw, account_id, payload.model_dump())


@app.post("/accounts/{from_id}/transfers")
def transfer(from_id: str, payload: TransferPayload):
    return _handle(nessie.transfer, from_id, payload.model_dump())


@app.post("/accounts/{account_id}/purchases")
def purchase(account_id: str, payload: MoneyPayload):
    """POST here creates a purchase (Nessie write) -- GET on this same path
    above lists purchases (category-enriched); different HTTP methods on
    the same path is fine, FastAPI routes them independently."""
    return _handle(nessie.purchase, account_id, payload.model_dump())


@app.post("/accounts/{account_id}/bills")
def create_bill(account_id: str, payload: BillPayload):
    return _handle(nessie.create_bill, account_id, payload.model_dump())


@app.delete("/accounts/{account_id}")
def remove_account(account_id: str):
    return _handle(nessie.delete_account, account_id)


@app.delete("/data")
def reset_data():
    return _handle(nessie.reset_data)


# ------------------------- Chat (Gemini, freeform multi-turn) -------------------------

@app.post("/chat")
def chat(req: ChatRequest):
    """Freeform multi-turn chat (no tools, the caller sends the whole
    message history each time) -- separate from POST /chat/message above,
    which is a single-turn call into a scoped tool-use assistant. Use this
    one when you want a general conversational assistant from the React
    app; use /chat/message when you want it to actually check balances,
    freeze the card, etc. for the seeded demo account."""
    try:
        reply = gemini.chat(
            [m.model_dump() for m in req.messages],
            system=SYSTEM_PROMPT,
        )
    except gemini.GeminiError as e:
        raise HTTPException(status_code=500, detail=e.detail)
    return {"reply": reply}


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
