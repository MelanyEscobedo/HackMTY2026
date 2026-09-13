from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import nessie
import gemini
from nessie import NessieError
from gemini import GeminiError

app = FastAPI(title="Capital You API", description="Proxy al Capital One Nessie API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _handle(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except NessieError as e:
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


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend FastAPI listo", "nessie": bool(nessie.NESSIE_API_KEY)}


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


@app.get("/accounts/{account_id}/purchases")
def purchases(account_id: str, request: Request):
    params = dict(request.query_params)
    return _handle(nessie.get_purchases, account_id, **params)


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


# ------------------------- Chat (Gemini) -------------------------

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        reply = gemini.chat(
            [m.model_dump() for m in req.messages],
            system=SYSTEM_PROMPT,
        )
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=e.detail)
    return {"reply": reply}