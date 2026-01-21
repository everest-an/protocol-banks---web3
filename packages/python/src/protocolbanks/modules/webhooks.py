"""
ProtocolBanks SDK - Webhook Module

Webhook 签名验证和事件解析
支持:
- HMAC-SHA256 签名验证
- 常量时间比较 (防时序攻击)
- 事件类型解析
"""

from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Any

from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import (
    ErrorCodes,
    WebhookEvent,
    WebhookEventType,
    WebhookVerificationResult,
)
from protocolbanks.utils.crypto import (
    constant_time_equal,
    generate_webhook_signature,
    hmac_sign,
)


# ============================================================================
# Constants
# ============================================================================

WEBHOOK_SIGNATURE_HEADER = "X-PB-Signature"
WEBHOOK_TIMESTAMP_HEADER = "X-PB-Timestamp"
DEFAULT_TIMESTAMP_TOLERANCE = 300  # 5 minutes

SUPPORTED_EVENT_TYPES: list[WebhookEventType] = [
    "payment.created",
    "payment.completed",
    "payment.failed",
    "payment.expired",
    "batch.created",
    "batch.processing",
    "batch.completed",
    "batch.failed",
    "x402.created",
    "x402.signed",
    "x402.executed",
    "x402.failed",
    "x402.expired",
]


class WebhookModule:
    """Webhook Module - Verify and parse webhook events"""

    def verify(
        self,
        payload: str,
        signature: str,
        secret: str,
        tolerance: int = DEFAULT_TIMESTAMP_TOLERANCE,
    ) -> WebhookVerificationResult:
        """Verify webhook signature"""
        try:
            # Parse signature header
            signature_parts = self._parse_signature_header(signature)

            if not signature_parts:
                return WebhookVerificationResult(
                    valid=False,
                    error="Invalid signature format",
                )

            timestamp, sig = signature_parts

            # Check timestamp
            now = int(time.time())
            timestamp_valid = abs(now - timestamp) <= tolerance

            if not timestamp_valid:
                return WebhookVerificationResult(
                    valid=False,
                    error="Webhook timestamp is outside tolerance window",
                    timestamp_valid=False,
                )

            # Generate expected signature
            expected_signature = self._generate_signature_sync(payload, secret, timestamp)

            # Constant-time comparison
            signature_valid = constant_time_equal(sig, expected_signature)

            if not signature_valid:
                return WebhookVerificationResult(
                    valid=False,
                    error="Invalid webhook signature",
                    timestamp_valid=True,
                )

            # Parse event
            event = self.parse(payload)

            return WebhookVerificationResult(
                valid=True,
                event=event,
                timestamp_valid=True,
            )

        except Exception as e:
            return WebhookVerificationResult(
                valid=False,
                error=str(e),
            )

    def parse(self, payload: str) -> WebhookEvent:
        """Parse webhook payload to event"""
        try:
            data = json.loads(payload)

            # Validate required fields
            if not data.get("id") or not data.get("type"):
                raise ProtocolBanksError(
                    code=ErrorCodes.VALID_REQUIRED_FIELD,
                    message="Webhook payload missing required fields (id, type)",
                    retryable=False,
                )

            # Validate event type
            if not self.is_valid_event_type(data["type"]):
                raise ProtocolBanksError(
                    code=ErrorCodes.VALID_INVALID_FORMAT,
                    message=f"Unknown webhook event type: {data['type']}",
                    retryable=False,
                )

            # Parse timestamp
            timestamp_value = data.get("timestamp")
            if isinstance(timestamp_value, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp_value)
            elif isinstance(timestamp_value, str):
                timestamp = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
            else:
                timestamp = datetime.now()

            return WebhookEvent(
                id=data["id"],
                type=data["type"],
                timestamp=timestamp,
                data=data.get("data", {}),
                signature=data.get("signature", ""),
            )

        except json.JSONDecodeError:
            raise ProtocolBanksError(
                code=ErrorCodes.VALID_INVALID_FORMAT,
                message="Invalid webhook payload JSON",
                retryable=False,
            )

    def sign(
        self, payload: str, secret: str, timestamp: int | None = None
    ) -> str:
        """Generate webhook signature (for testing)"""
        ts = timestamp or int(time.time())
        sig = self._generate_signature_sync(payload, secret, ts)
        return f"t={ts},v1={sig}"

    def get_supported_event_types(self) -> list[WebhookEventType]:
        """Get supported event types"""
        return SUPPORTED_EVENT_TYPES.copy()

    def is_valid_event_type(self, event_type: str) -> bool:
        """Check if event type is valid"""
        return event_type in SUPPORTED_EVENT_TYPES

    # ============================================================================
    # Private Methods
    # ============================================================================

    def _parse_signature_header(
        self, header: str
    ) -> tuple[int, str] | None:
        """Parse signature header format: t=timestamp,v1=signature"""
        try:
            parts = header.split(",")
            timestamp = 0
            sig = ""

            for part in parts:
                if "=" in part:
                    key, value = part.split("=", 1)
                    if key == "t":
                        timestamp = int(value)
                    elif key == "v1":
                        sig = value

            if timestamp == 0 or not sig:
                return None

            return (timestamp, sig)

        except Exception:
            return None

    def _generate_signature_sync(
        self, payload: str, secret: str, timestamp: int
    ) -> str:
        """Generate signature synchronously"""
        data_to_sign = f"{timestamp}.{payload}"
        return hmac_sign(data_to_sign, secret)


def create_webhook_module() -> WebhookModule:
    """Create a new WebhookModule instance"""
    return WebhookModule()


# ============================================================================
# Event Type Helpers
# ============================================================================


def is_payment_event(event: WebhookEvent) -> bool:
    """Check if event is a payment event"""
    return event.type.startswith("payment.")


def is_batch_event(event: WebhookEvent) -> bool:
    """Check if event is a batch event"""
    return event.type.startswith("batch.")


def is_x402_event(event: WebhookEvent) -> bool:
    """Check if event is an x402 event"""
    return event.type.startswith("x402.")


def is_success_event(event: WebhookEvent) -> bool:
    """Check if event indicates success"""
    return event.type.endswith(".completed") or event.type.endswith(".executed")


def is_failure_event(event: WebhookEvent) -> bool:
    """Check if event indicates failure"""
    return event.type.endswith(".failed") or event.type.endswith(".expired")
