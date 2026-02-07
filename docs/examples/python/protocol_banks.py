"""
Protocol Banks - Python SDK Example

Lightweight wrapper around the Protocol Banks REST API.
Copy this file into your project or use it as a reference.

Requirements: Python 3.9+, requests (pip install requests)

Usage:
    from protocol_banks import ProtocolBanks

    pb = ProtocolBanks(
        wallet_address="0xYourWallet...",
        base_url="https://app.protocolbanks.com/api",
    )

    invoice = pb.invoices.create(amount=25, token="USDC", ...)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urlencode

import requests


# ─── Exceptions ───────────────────────────────────────────────────────


class ProtocolBanksError(Exception):
    """Raised when the API returns a non-2xx response."""

    def __init__(self, message: str, status: int, body: Any):
        super().__init__(message)
        self.status = status
        self.body = body


class RateLimitError(ProtocolBanksError):
    """429 Too Many Requests."""

    def __init__(self, message: str, body: Any, retry_after: Optional[int] = None):
        super().__init__(message, 429, body)
        self.retry_after = retry_after


# ─── SDK Client ──────────────────────────────────────────────────────


@dataclass
class ProtocolBanks:
    wallet_address: str
    base_url: str = "https://app.protocolbanks.com/api"
    api_key: Optional[str] = None
    timeout: int = 30

    # Sub-clients (initialized in __post_init__)
    invoices: InvoiceClient = field(init=False)
    payments: PaymentClient = field(init=False)
    vendors: VendorClient = field(init=False)
    webhooks: WebhookClient = field(init=False)
    yield_: YieldClient = field(init=False)
    analytics: AnalyticsClient = field(init=False)

    def __post_init__(self):
        self.base_url = self.base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"x-user-address": self.wallet_address})
        if self.api_key:
            self._session.headers["x-api-key"] = self.api_key

        self.invoices = InvoiceClient(self)
        self.payments = PaymentClient(self)
        self.vendors = VendorClient(self)
        self.webhooks = WebhookClient(self)
        self.yield_ = YieldClient(self)
        self.analytics = AnalyticsClient(self)

    def request(self, method: str, path: str, json: Any = None, params: dict | None = None) -> dict:
        """Make an authenticated API request."""
        url = f"{self.base_url}{path}"

        resp = self._session.request(
            method, url, json=json, params=params, timeout=self.timeout
        )

        body = resp.json()

        if not resp.ok:
            msg = body.get("error", f"HTTP {resp.status_code}")
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                raise RateLimitError(
                    msg, body, int(retry_after) if retry_after else None
                )
            raise ProtocolBanksError(msg, resp.status_code, body)

        return body

    def health(self) -> dict:
        """Quick health check (no auth required)."""
        resp = requests.get(f"{self.base_url}/health", timeout=self.timeout)
        return resp.json()


# ─── Resource Clients ────────────────────────────────────────────────


class InvoiceClient:
    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def list(self) -> dict:
        """List all invoices."""
        return self._sdk.request("GET", "/invoice")

    def create(
        self,
        amount: float,
        recipient_address: str,
        token: str = "USDC",
        description: str | None = None,
        customer_email: str | None = None,
        expires_at: str | None = None,
    ) -> dict:
        """Create a new invoice."""
        payload: dict[str, Any] = {
            "amount": amount,
            "recipient_address": recipient_address,
            "token": token,
        }
        if description:
            payload["description"] = description
        if customer_email:
            payload["customer_email"] = customer_email
        if expires_at:
            payload["expires_at"] = expires_at

        return self._sdk.request("POST", "/invoice", json=payload)


class PaymentClient:
    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def list(
        self,
        status: str | None = None,
        network: str | None = None,
        network_type: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        """List payments with optional filters."""
        params: dict[str, Any] = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if network:
            params["network"] = network
        if network_type:
            params["network_type"] = network_type

        return self._sdk.request("GET", "/payments", params=params)

    def verify(self, tx_hash: str, order_id: str, amount: str) -> dict:
        """Verify that a payment was completed on-chain."""
        return self._sdk.request(
            "POST",
            "/verify-payment",
            json={"txHash": tx_hash, "orderId": order_id, "amount": amount},
        )


class VendorClient:
    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def list(self) -> dict:
        """List all vendors."""
        return self._sdk.request("GET", "/vendors")

    def create(
        self,
        name: str,
        wallet_address: str,
        category: str | None = None,
        tags: list[str] | None = None,
    ) -> dict:
        """Create a single-address vendor."""
        payload: dict[str, Any] = {
            "name": name,
            "wallet_address": wallet_address,
        }
        if category:
            payload["category"] = category
        if tags:
            payload["tags"] = tags

        return self._sdk.request("POST", "/vendors", json=payload)

    def create_multi_network(
        self,
        name: str,
        addresses: list[dict[str, Any]],
    ) -> dict:
        """Create a multi-network vendor.

        addresses example:
            [
                {"network": "ethereum", "address": "0x...", "label": "Main", "isPrimary": True},
                {"network": "tron", "address": "T...", "label": "TRON wallet"},
            ]
        """
        return self._sdk.request(
            "POST",
            "/vendors/multi-network",
            json={"name": name, "addresses": addresses},
        )


class WebhookClient:
    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def list(self) -> dict:
        """List all webhooks."""
        return self._sdk.request("GET", "/webhooks")

    def create(self, name: str, url: str, events: list[str]) -> dict:
        """Create a new webhook.

        Supported events:
            payment.completed, payment.failed, invoice.paid, vendor.updated
        """
        return self._sdk.request(
            "POST",
            "/webhooks",
            json={"name": name, "url": url, "events": events},
        )


class YieldClient:
    """Auto-yield management (Aave V3 + JustLend)."""

    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def balance(self, merchant: str, network: str) -> dict:
        """Get yield balance for a single network."""
        return self._sdk.request(
            "GET",
            "/yield/balance",
            params={"merchant": merchant, "network": network},
        )

    def summary(self, merchant: str) -> dict:
        """Get cross-network yield summary."""
        return self._sdk.request(
            "GET",
            "/yield/balance",
            params={"merchant": merchant, "summary": "true"},
        )

    def stats(self, network: str | None = None) -> dict:
        """Get yield statistics for one or all networks."""
        params = {"network": network} if network else None
        return self._sdk.request("GET", "/yield/stats", params=params)

    def recommendation(self) -> dict:
        """Get the best current yield recommendation."""
        return self._sdk.request("GET", "/yield/recommendation")


class AnalyticsClient:
    def __init__(self, sdk: ProtocolBanks):
        self._sdk = sdk

    def summary(self) -> dict:
        """Get payment analytics summary."""
        return self._sdk.request("GET", "/analytics/summary")

    def monthly(self) -> dict:
        """Get monthly payment data (12 months)."""
        return self._sdk.request("GET", "/analytics/monthly")

    def by_chain(self) -> dict:
        """Get analytics grouped by chain."""
        return self._sdk.request("GET", "/analytics/by-chain")

    def by_vendor(self) -> dict:
        """Get analytics grouped by vendor."""
        return self._sdk.request("GET", "/analytics/by-vendor")
