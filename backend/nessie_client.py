"""
Minimal wrapper around Capital One's Nessie hackathon API.

Everything goes through one helper (`_request`) so you get consistent,
loud error messages when a field name is wrong -- which WILL happen, because
Nessie's docs are thin and every hackathon team hits this. When something
fails, this prints the exact status code + response body from Nessie so you
can see what it actually wanted.

Base URL: https://api.nessieisreal.com  (HTTPS -- plain HTTP is refused)
Auth: API key is passed as a query parameter (?key=...), not a header.
"""

import os
import requests

BASE_URL = os.getenv("NESSIE_BASE_URL", "https://api.nessieisreal.com")


class NessieError(Exception):
    def __init__(self, method, path, status_code, body):
        self.method = method
        self.path = path
        self.status_code = status_code
        self.body = body
        super().__init__(
            f"Nessie {method} {path} failed [{status_code}]: {body}"
        )


class NessieClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("NESSIE_API_KEY")
        if not self.api_key:
            raise RuntimeError(
                "No Nessie API key found. Set NESSIE_API_KEY in your .env "
                "file, or pass api_key=... explicitly."
            )

    def _request(self, method: str, path: str, json: dict | None = None):
        url = f"{BASE_URL}{path}"
        params = {"key": self.api_key}
        resp = requests.request(method, url, params=params, json=json, timeout=15)

        # Loud, readable errors -- Nessie usually tells you exactly which
        # field it didn't like in the response body.
        if not resp.ok:
            raise NessieError(method, path, resp.status_code, resp.text)

        if resp.text.strip() == "":
            return None
        return resp.json()

    # ---- generic verbs, use these directly if you need an endpoint below
    # doesn't wrap yet ----
    def get(self, path: str):
        return self._request("GET", path)

    def post(self, path: str, data: dict):
        return self._request("POST", path, json=data)

    def put(self, path: str, data: dict):
        return self._request("PUT", path, json=data)

    def delete(self, path: str):
        return self._request("DELETE", path)

    # ---- convenience methods for the resources this project needs ----

    def create_customer(self, first_name: str, last_name: str, address: dict) -> dict:
        """address = {"street_number": "1600", "street_name": "Green St",
        "city": "Henrico", "state": "VA", "zip": "23233"}"""
        return self.post("/customers", {
            "first_name": first_name,
            "last_name": last_name,
            "address": address,
        })

    def get_customer_accounts(self, customer_id: str) -> list:
        return self.get(f"/customers/{customer_id}/accounts")

    def create_account(self, customer_id: str, account_type: str, nickname: str,
                        balance: float, rewards: int = 0) -> dict:
        """account_type is usually "Checking", "Savings", or "Credit Card"."""
        return self.post(f"/customers/{customer_id}/accounts", {
            "type": account_type,
            "nickname": nickname,
            "rewards": rewards,
            "balance": balance,
        })

    def get_account(self, account_id: str) -> dict:
        return self.get(f"/accounts/{account_id}")

    def list_merchants(self) -> list:
        return self.get("/merchants")

    def create_merchant(self, name: str, category: str, lat: float = 0.0, lng: float = 0.0) -> dict:
        return self.post("/merchants", {
            "name": name,
            "category": category,
            "geocode": {"lat": lat, "lng": lng},
        })

    def create_purchase(self, account_id: str, merchant_id: str, amount: float,
                         purchase_date: str, description: str = "", medium: str = "balance") -> dict:
        """purchase_date format: "YYYY-MM-DD" """
        return self.post(f"/accounts/{account_id}/purchases", {
            "merchant_id": merchant_id,
            "medium": medium,
            "purchase_date": purchase_date,
            "amount": amount,
            "description": description,
            "status": "completed",
        })

    def get_account_purchases(self, account_id: str) -> list:
        return self.get(f"/accounts/{account_id}/purchases")
