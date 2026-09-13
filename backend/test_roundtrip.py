"""
Step 2 + 3 from the build plan: prove the Nessie pipeline works end to end,
and print the REAL response shapes back so you can see exactly what fields
you actually get before building detection/UI logic on top of assumptions.

Run this FIRST, before writing any other code. If this script runs clean,
your foundation is solid. If it errors, read the printed response body --
Nessie almost always tells you exactly which field it rejected.

Usage:
    1. Copy .env.example to .env and paste in your real NESSIE_API_KEY
    2. pip install -r requirements.txt
    3. python test_roundtrip.py
"""

import json
from datetime import date

from dotenv import load_dotenv
load_dotenv()

from nessie_client import NessieClient, NessieError


def show(label, obj):
    print(f"\n--- {label} ---")
    print(json.dumps(obj, indent=2, default=str))


def main():
    client = NessieClient()

    try:
        # 1. Create a customer
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
        show("Created customer (raw response)", customer)

        # Nessie sometimes wraps the new object under "objectCreated" and
        # sometimes returns it flat -- print the raw response above so you
        # can see which shape YOUR key/tier returns, then adjust this line.
        customer_id = (
            customer.get("objectCreated", {}).get("_id")
            or customer.get("_id")
        )
        if not customer_id:
            print("!! Could not find customer _id in the response above. "
                  "Check the raw JSON printed and adjust test_roundtrip.py.")
            return
        print(f"\ncustomer_id = {customer_id}")

        # 2. Create an account for that customer
        account = client.create_account(
            customer_id=customer_id,
            account_type="Checking",
            nickname="Maria's Everyday Account",
            balance=500,
        )
        show("Created account (raw response)", account)

        account_id = (
            account.get("objectCreated", {}).get("_id")
            or account.get("_id")
        )
        if not account_id:
            print("!! Could not find account _id in the response above.")
            return
        print(f"\naccount_id = {account_id}")

        # 3. Get a merchant to purchase from (use an existing one if the
        # sandbox already has seeded merchants -- much simpler than creating
        # your own and guessing at required fields)
        merchants = client.list_merchants()
        show("Sample of existing merchants (first 3)", merchants[:3] if merchants else merchants)

        if merchants:
            merchant_id = merchants[0]["_id"]
            print(f"\nUsing existing merchant_id = {merchant_id} ({merchants[0].get('name')})")
        else:
            new_merchant = client.create_merchant(
                name="Test Grocery Co", category="Groceries"
            )
            show("Created merchant (raw response)", new_merchant)
            merchant_id = (
                new_merchant.get("objectCreated", {}).get("_id")
                or new_merchant.get("_id")
            )

        # 4. Post a purchase
        purchase = client.create_purchase(
            account_id=account_id,
            merchant_id=merchant_id,
            amount=42.50,
            purchase_date=str(date.today()),
            description="Round-trip test purchase",
        )
        show("Created purchase (raw response)", purchase)

        # 5. Read purchases back for that account -- THIS is the shape your
        # detection logic and spending-breakdown screen will actually consume.
        purchases = client.get_account_purchases(account_id)
        show("Purchases for this account (this is your real data shape)", purchases)

        print("\n✅ Round trip complete: customer -> account -> merchant -> "
              "purchase -> read back. Copy the field names you saw above into "
              "your seeding script and detection logic.")

    except NessieError as e:
        print(f"\n❌ Nessie call failed: {e}")
        print("Read the response body above -- it usually names the exact "
              "field that was missing or malformed.")


if __name__ == "__main__":
    main()
