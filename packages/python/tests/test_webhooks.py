"""Tests for Webhook Module"""

import json
import time

import pytest

from protocolbanks.errors import ProtocolBanksError
from protocolbanks.modules.webhooks import (
    WebhookModule,
    is_batch_event,
    is_failure_event,
    is_payment_event,
    is_success_event,
    is_x402_event,
)
from protocolbanks.types import ErrorCodes


@pytest.fixture
def webhook_module() -> WebhookModule:
    """Create WebhookModule instance"""
    return WebhookModule()


class TestWebhookSignature:
    """Tests for webhook signature"""

    def test_sign_and_verify(self, webhook_module: WebhookModule, webhook_secret: str):
        """Should sign and verify webhook"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})
        timestamp = int(time.time())

        signature = webhook_module.sign(payload, webhook_secret, timestamp)
        result = webhook_module.verify(payload, signature, webhook_secret)

        assert result.valid is True
        assert result.timestamp_valid is True

    def test_verify_invalid_signature(self, webhook_module: WebhookModule, webhook_secret: str):
        """Should reject invalid signature"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})

        result = webhook_module.verify(payload, "t=123,v1=invalid", webhook_secret)
        assert result.valid is False

    def test_verify_expired_timestamp(self, webhook_module: WebhookModule, webhook_secret: str):
        """Should reject expired timestamp"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})
        old_timestamp = int(time.time()) - 600  # 10 minutes ago

        signature = webhook_module.sign(payload, webhook_secret, old_timestamp)
        result = webhook_module.verify(payload, signature, webhook_secret, tolerance=300)

        assert result.valid is False
        assert result.timestamp_valid is False

    def test_verify_malformed_signature(self, webhook_module: WebhookModule, webhook_secret: str):
        """Should reject malformed signature"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})

        result = webhook_module.verify(payload, "malformed", webhook_secret)
        assert result.valid is False
        assert result.error == "Invalid signature format"


class TestWebhookParsing:
    """Tests for webhook parsing"""

    def test_parse_valid_event(self, webhook_module: WebhookModule):
        """Should parse valid webhook event"""
        payload = json.dumps(
            {
                "id": "evt_123",
                "type": "payment.completed",
                "timestamp": int(time.time()),
                "data": {"payment_id": "pay_123", "amount": "100"},
            }
        )

        event = webhook_module.parse(payload)
        assert event.id == "evt_123"
        assert event.type == "payment.completed"
        assert event.data["payment_id"] == "pay_123"

    def test_parse_missing_id(self, webhook_module: WebhookModule):
        """Should reject event without id"""
        payload = json.dumps({"type": "payment.completed", "data": {}})

        with pytest.raises(ProtocolBanksError) as exc_info:
            webhook_module.parse(payload)
        assert exc_info.value.code == ErrorCodes.VALID_REQUIRED_FIELD

    def test_parse_invalid_type(self, webhook_module: WebhookModule):
        """Should reject unknown event type"""
        payload = json.dumps({"id": "evt_123", "type": "unknown.event", "data": {}})

        with pytest.raises(ProtocolBanksError) as exc_info:
            webhook_module.parse(payload)
        assert exc_info.value.code == ErrorCodes.VALID_INVALID_FORMAT

    def test_parse_invalid_json(self, webhook_module: WebhookModule):
        """Should reject invalid JSON"""
        with pytest.raises(ProtocolBanksError) as exc_info:
            webhook_module.parse("not json")
        assert exc_info.value.code == ErrorCodes.VALID_INVALID_FORMAT


class TestEventTypeHelpers:
    """Tests for event type helper functions"""

    def test_is_payment_event(self, webhook_module: WebhookModule):
        """Should identify payment events"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})
        event = webhook_module.parse(payload)
        assert is_payment_event(event) is True
        assert is_batch_event(event) is False

    def test_is_batch_event(self, webhook_module: WebhookModule):
        """Should identify batch events"""
        payload = json.dumps({"id": "evt_123", "type": "batch.completed", "data": {}})
        event = webhook_module.parse(payload)
        assert is_batch_event(event) is True
        assert is_payment_event(event) is False

    def test_is_x402_event(self, webhook_module: WebhookModule):
        """Should identify x402 events"""
        payload = json.dumps({"id": "evt_123", "type": "x402.executed", "data": {}})
        event = webhook_module.parse(payload)
        assert is_x402_event(event) is True

    def test_is_success_event(self, webhook_module: WebhookModule):
        """Should identify success events"""
        payload = json.dumps({"id": "evt_123", "type": "payment.completed", "data": {}})
        event = webhook_module.parse(payload)
        assert is_success_event(event) is True
        assert is_failure_event(event) is False

    def test_is_failure_event(self, webhook_module: WebhookModule):
        """Should identify failure events"""
        payload = json.dumps({"id": "evt_123", "type": "payment.failed", "data": {}})
        event = webhook_module.parse(payload)
        assert is_failure_event(event) is True
        assert is_success_event(event) is False


class TestSupportedEventTypes:
    """Tests for supported event types"""

    def test_get_supported_event_types(self, webhook_module: WebhookModule):
        """Should return all supported event types"""
        types = webhook_module.get_supported_event_types()
        assert "payment.completed" in types
        assert "batch.completed" in types
        assert "x402.executed" in types

    def test_is_valid_event_type(self, webhook_module: WebhookModule):
        """Should validate event types"""
        assert webhook_module.is_valid_event_type("payment.completed") is True
        assert webhook_module.is_valid_event_type("unknown.type") is False
