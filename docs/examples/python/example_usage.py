"""
Protocol Banks - Python Usage Examples

Run with: python example_usage.py

Requirements: pip install requests
"""

import hashlib
import hmac
import os
import time

from protocol_banks import ProtocolBanks, ProtocolBanksError, RateLimitError

WALLET = os.getenv("PB_WALLET", "0xYourWalletAddress")
BASE_URL = os.getenv("PB_BASE_URL", "http://localhost:3000/api")

pb = ProtocolBanks(wallet_address=WALLET, base_url=BASE_URL)


# ─── Example 1: Health Check ─────────────────────────────────────────


def check_health():
    health = pb.health()
    print("Health:", health)


# ─── Example 2: Create an Invoice ────────────────────────────────────


def create_invoice():
    result = pb.invoices.create(
        amount=50.00,
        token="USDC",
        recipient_address=WALLET,
        description="Order #9876",
        customer_email="buyer@example.com",
        expires_at="2026-04-01T00:00:00Z",
    )
    print("Invoice created:", result["data"])
    return result["data"]


# ─── Example 3: List Payments with Filters ───────────────────────────


def list_payments():
    result = pb.payments.list(status="completed", network_type="EVM", limit=10)
    payments = result["data"]
    print(f"Found {len(payments)} payments")
    for p in payments:
        print(f"  {p['tx_hash']} — {p['amount']} {p['token']} on {p['chain']}")


# ─── Example 4: Verify a Payment ─────────────────────────────────────


def verify_payment(tx_hash: str, order_id: str):
    result = pb.payments.verify(
        tx_hash=tx_hash,
        order_id=order_id,
        amount="50.00",
    )
    if result["data"]["valid"]:
        print("Payment is valid!")
    else:
        print("Payment invalid:", result["data"].get("reason"))


# ─── Example 5: Create a Multi-Network Vendor ────────────────────────


def create_vendor():
    result = pb.vendors.create_multi_network(
        name="Acme Global Supplier",
        addresses=[
            {
                "network": "ethereum",
                "address": "0x1234567890abcdef1234567890abcdef12345678",
                "label": "Main ETH wallet",
                "isPrimary": True,
            },
            {
                "network": "tron",
                "address": "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",
                "label": "TRON settlement",
            },
        ],
    )
    print("Vendor created:", result["data"])


# ─── Example 6: Set Up a Webhook ─────────────────────────────────────


def setup_webhook():
    result = pb.webhooks.create(
        name="My Server",
        url="https://my-server.com/webhooks/pb",
        events=["payment.completed", "payment.failed", "invoice.paid"],
    )
    print("Webhook created:", result["data"])


# ─── Example 7: Yield — Cross-Network Summary ───────────────────────


def check_yield():
    # Get best recommendation
    rec = pb.yield_.recommendation()
    r = rec["data"]["recommendation"]
    print(f"Best yield: {r['apy']}% APY on {r['network']} ({r['protocol']})")

    # Get cross-network summary
    summary = pb.yield_.summary(WALLET)
    s = summary["data"]
    print(f"Total balance: ${s['totalBalance']}")
    print(f"Total interest: ${s['totalInterest']}")
    print(f"Average APY: {s['averageAPY']}%")


# ─── Example 8: Analytics ────────────────────────────────────────────


def get_analytics():
    summary = pb.analytics.summary()
    monthly = pb.analytics.monthly()
    by_chain = pb.analytics.by_chain()

    print("Analytics summary:", summary["data"])
    print("Monthly data:", monthly["data"])
    print("By chain:", by_chain["data"])


# ─── Example 9: Error Handling with Retry ─────────────────────────────


def error_handling_example():
    try:
        pb.payments.verify(
            tx_hash="invalid",
            order_id="test",
            amount="10",
        )
    except RateLimitError as e:
        wait = e.retry_after or 60
        print(f"Rate limited — retrying in {wait}s")
        time.sleep(wait)
    except ProtocolBanksError as e:
        print(f"API Error ({e.status}): {e}")
        # e.status — HTTP status code (400, 401, 404, 429, 500…)
        # e.body   — full JSON response from the server


# ─── Example 10: Webhook Signature Verification (Flask) ──────────────

"""
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["PB_WEBHOOK_SECRET"]

@app.route("/webhooks/pb", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("x-pb-signature", "")
    timestamp = request.headers.get("x-pb-timestamp", "")

    # Verify signature
    payload = f"{timestamp}.{request.get_data(as_text=True)}"
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        return jsonify(error="Invalid signature"), 401

    # Reject stale events (> 5 minutes)
    age = time.time() - int(timestamp)
    if age > 300:
        return jsonify(error="Stale event"), 400

    # Process event
    data = request.json
    event = data["event"]

    if event == "payment.completed":
        print(f"Payment received: {data['data']['tx_hash']}")
    elif event == "invoice.paid":
        print(f"Invoice paid: {data['data']['invoice_id']}")

    return jsonify(received=True)

if __name__ == "__main__":
    app.run(port=4000)
"""


# ─── Run Examples ─────────────────────────────────────────────────────


def main():
    print("=== Protocol Banks Python SDK Examples ===\n")

    check_health()
    print()

    # Uncomment examples to run:
    # create_invoice()
    # list_payments()
    # verify_payment("0xabc...", "order_123")
    # create_vendor()
    # setup_webhook()
    # check_yield()
    # get_analytics()
    # error_handling_example()


if __name__ == "__main__":
    main()
