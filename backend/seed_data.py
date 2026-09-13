"""
Creates the demo persona (Maria Hopper) with a realistic normal purchase
history, THEN appends a 4-purchase fraud burst at the end (Gas -> Electronics
-> Jewelry -> Gift Cards) -- the exact scenario the Hopscotch mockup shows.

Run this once before starting the backend demo:
    python seed_data.py

It writes demo_account.json, which main.py's /demo-account endpoint reads
to tell the frontend which account to display. Safe to re-run -- it creates
a fresh customer/account each time (Nessie doesn't give you a clean way to
wipe purchase history on an existing account).
"""

import json
from datetime import date, timedelta

from dotenv import load_dotenv
load_dotenv()

from nessie_client import NessieClient, NessieError

# Matches baseline.py's demo numbers exactly, for continuity with the
# mockup and with the standalone baseline.py test run.
NORMAL_HISTORY = (
    [("Groceries", 45, 90)] * 20      # (category, min $, max $) x count
    + [("Gas", 30, 55)] * 12
    + [("Coffee Shops", 4, 8)] * 8
    + [("Streaming Services", 15.99, 15.99)] * 3
)

FRAUD_BURST = [
    ("Gas", 2.50, 2.50),         # small "card test" charge
    ("Electronics", 640, 640),
    ("Jewelry", 890, 890),
    ("Gift Cards", 200, 200),
]


def find_or_create_merchant(client: NessieClient, category: str, cache: dict) -> str:
    if category in cache:
        return cache[category]

    merchants = client.list_merchants() or []
    for m in merchants:
        m_category = m.get("category")
        if isinstance(m_category, list):
            m_category = m_category[0] if m_category else ""
        if (m_category or "").strip().lower() == category.lower():
            cache[category] = m["_id"]
            return m["_id"]

    print(f"  No existing merchant for '{category}', creating one...")
    created = client.create_merchant(name=f"Sample {category} Co", category=category)
    merchant_id = created.get("objectCreated", {}).get("_id") or created.get("_id")
    cache[category] = merchant_id
    return merchant_id


def main():
    client = NessieClient()
    merchant_cache: dict[str, str] = {}

    print("Creating customer...")
    customer = client.create_customer(
        first_name="Maria",
        last_name="Hopper",
        address={
            "street_number": "1600",
            "street_name": "Green Street",
            "city": "Henrico",
            "state": "VA",
            "zip": "23233",
        },
    )
    customer_id = customer.get("objectCreated", {}).get("_id") or customer.get("_id")
    print(f"  customer_id = {customer_id}")

    print("Creating checking account...")
    account = client.create_account(
        customer_id=customer_id,
        account_type="Checking",
        nickname="Everyday Account",
        balance=1428.53,
    )
    account_id = account.get("objectCreated", {}).get("_id") or account.get("_id")
    print(f"  account_id = {account_id}")

    print(f"Seeding {len(NORMAL_HISTORY)} normal purchases over the past 30 days...")
    total = len(NORMAL_HISTORY)
    for i, (category, lo, hi) in enumerate(NORMAL_HISTORY):
        days_ago = int((total - i) / total * 30) + 1
        purchase_date = str(date.today() - timedelta(days=days_ago))
        amount = round(lo + (hi - lo) * ((i * 37) % 100) / 100, 2)  # cheap deterministic spread
        merchant_id = find_or_create_merchant(client, category, merchant_cache)
        try:
            client.create_purchase(
                account_id=account_id,
                merchant_id=merchant_id,
                amount=amount,
                purchase_date=purchase_date,
                description=f"{category} purchase",
            )
        except NessieError as e:
            print(f"  !! purchase {i} failed: {e}")
        if (i + 1) % 10 == 0:
            print(f"  ...{i + 1}/{total} normal purchases posted")

    print("Seeding the fraud burst (today, in sequence)...")
    for category, lo, hi in FRAUD_BURST:
        merchant_id = find_or_create_merchant(client, category, merchant_cache)
        amount = round((lo + hi) / 2, 2)
        try:
            client.create_purchase(
                account_id=account_id,
                merchant_id=merchant_id,
                amount=amount,
                purchase_date=str(date.today()),
                description=f"{category} purchase (burst)",
            )
            print(f"  posted burst purchase: {category} (${amount})")
        except NessieError as e:
            print(f"  !! burst purchase for {category} failed: {e}")

    with open("demo_account.json", "w") as f:
        json.dump({
            "customer_id": customer_id,
            "account_id": account_id,
            "first_name": "Maria",
            "last_name": "Hopper",
        }, f, indent=2)

    print(f"\n✅ Done. Wrote demo_account.json.")
    print(f"   Start the backend (`uvicorn main:app --reload`) then open the")
    print(f"   Hopscotch mockup page -- it will pull this account live.")


if __name__ == "__main__":
    main()
