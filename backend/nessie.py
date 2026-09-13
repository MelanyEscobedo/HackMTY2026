import os
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

NESSIE_BASE_URL = os.getenv("NESSIE_BASE_URL", "https://api.nessieisreal.com")
NESSIE_API_KEY = os.getenv("NESSIE_API_KEY", "")

RETRIES = 4
RETRY_BACKOFF = 0.5


class NessieError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _client() -> httpx.Client:
    return httpx.Client(base_url=NESSIE_BASE_URL, timeout=30.0)


def _request(method: str, path: str, params: dict | None = None, json: dict | None = None) -> dict | list:
    if not NESSIE_API_KEY:
        raise NessieError(500, "NESSIE_API_KEY no configurada en backend/.env")
    query = {"key": NESSIE_API_KEY, **(params or {})}
    last_error: Exception | None = None
    for attempt in range(RETRIES):
        try:
            with _client() as client:
                resp = client.request(method, path, params=query, json=json)
            if resp.status_code >= 400:
                try:
                    detail = resp.json().get("message", resp.text)
                except Exception:
                    detail = resp.text
                raise NessieError(resp.status_code, detail)
            return resp.json()
        except httpx.ConnectError as e:
            last_error = e
            if attempt < RETRIES - 1:
                time.sleep(RETRY_BACKOFF * (attempt + 1))
    raise NessieError(502, f"No se pudo conectar con el API de Nessie: {last_error}")


def get_accounts() -> list:
    return _request("GET", "/accounts")


def get_account(account_id: str) -> dict:
    return _request("GET", f"/accounts/{account_id}")


def get_customers() -> list:
    return _request("GET", "/customers")


def get_customer(customer_id: str) -> dict:
    return _request("GET", f"/customers/{customer_id}")


def get_customer_accounts(customer_id: str) -> list:
    return _request("GET", f"/customers/{customer_id}/accounts")


def get_transactions(account_id: str, **filters) -> list:
    return _request("GET", f"/accounts/{account_id}/transactions", params=filters or None)


def get_deposits(account_id: str) -> list:
    return _request("GET", f"/accounts/{account_id}/deposits")


def get_withdrawals(account_id: str) -> list:
    return _request("GET", f"/accounts/{account_id}/withdrawals")


def get_transfers(account_id: str) -> list:
    return _request("GET", f"/accounts/{account_id}/transfers")


def get_purchases(account_id: str, **filters) -> list:
    return _request("GET", f"/accounts/{account_id}/purchases", params=filters or None)


def get_bills(account_id: str) -> list:
    return _request("GET", f"/accounts/{account_id}/bills")


def create_customer(payload: dict) -> dict:
    return _request("POST", "/customers", json=payload)


def create_account(customer_id: str, payload: dict) -> dict:
    return _request("POST", f"/customers/{customer_id}/accounts", json=payload)


def deposit(account_id: str, payload: dict) -> dict:
    return _request("POST", f"/accounts/{account_id}/deposits", json=payload)


def withdraw(account_id: str, payload: dict) -> dict:
    return _request("POST", f"/accounts/{account_id}/withdrawals", json=payload)


def transfer(from_id: str, payload: dict) -> dict:
    return _request("POST", f"/accounts/{from_id}/transfers", json=payload)


def purchase(account_id: str, payload: dict) -> dict:
    return _request("POST", f"/accounts/{account_id}/purchases", json=payload)


def create_bill(account_id: str, payload: dict) -> dict:
    return _request("POST", f"/accounts/{account_id}/bills", json=payload)


def delete_account(account_id: str) -> dict:
    return _request("DELETE", f"/accounts/{account_id}")


def reset_data() -> dict:
    return _request("DELETE", "/data")