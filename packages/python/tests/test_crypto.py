"""Tests for cryptography utilities"""

import pytest

from protocolbanks.utils.crypto import (
    constant_time_equal,
    generate_nonce,
    generate_payment_link_signature,
    generate_uuid,
    generate_webhook_signature,
    hmac_sign,
    hmac_sign_short,
    hmac_verify,
    mask_sensitive,
    random_bytes,
    random_hex,
    sanitize_for_logging,
    verify_payment_link_signature,
)


class TestRandomGeneration:
    """Tests for random generation"""

    def test_random_bytes_length(self):
        """Should generate correct length bytes"""
        result = random_bytes(32)
        assert len(result) == 32

    def test_random_hex_length(self):
        """Should generate correct length hex string"""
        result = random_hex(16)
        assert len(result) == 32  # 16 bytes = 32 hex chars

    def test_generate_uuid_format(self):
        """Should generate valid UUID format"""
        result = generate_uuid()
        assert len(result) == 36
        assert result.count("-") == 4

    def test_generate_nonce_format(self):
        """Should generate valid nonce format"""
        result = generate_nonce()
        assert result.startswith("0x")
        assert len(result) == 66  # 0x + 64 hex chars

    def test_nonce_uniqueness(self):
        """Should generate unique nonces"""
        nonces = [generate_nonce() for _ in range(100)]
        assert len(set(nonces)) == 100


class TestHMAC:
    """Tests for HMAC operations"""

    def test_hmac_sign(self):
        """Should generate HMAC signature"""
        result = hmac_sign("test data", "secret")
        assert len(result) == 64  # SHA256 = 64 hex chars

    def test_hmac_sign_short(self):
        """Should generate truncated HMAC signature"""
        result = hmac_sign_short("test data", "secret")
        assert len(result) == 16

    def test_hmac_verify_valid(self):
        """Should verify valid signature"""
        data = "test data"
        secret = "secret"
        signature = hmac_sign(data, secret)
        assert hmac_verify(data, signature, secret) is True

    def test_hmac_verify_invalid(self):
        """Should reject invalid signature"""
        assert hmac_verify("test data", "invalid", "secret") is False

    def test_hmac_deterministic(self):
        """Should produce same signature for same input"""
        sig1 = hmac_sign("test", "secret")
        sig2 = hmac_sign("test", "secret")
        assert sig1 == sig2


class TestConstantTimeComparison:
    """Tests for constant time comparison"""

    def test_equal_strings(self):
        """Should return True for equal strings"""
        assert constant_time_equal("test", "test") is True

    def test_unequal_strings(self):
        """Should return False for unequal strings"""
        assert constant_time_equal("test", "other") is False

    def test_different_lengths(self):
        """Should return False for different length strings"""
        assert constant_time_equal("test", "testing") is False


class TestPaymentLinkSignature:
    """Tests for payment link signature"""

    def test_generate_signature(self):
        """Should generate payment link signature"""
        signature = generate_payment_link_signature(
            to="0x1234567890123456789012345678901234567890",
            amount="100",
            token="USDC",
            expiry=1700000000000,
            secret="test_secret",
        )
        assert len(signature) == 16

    def test_verify_signature_valid(self):
        """Should verify valid payment link signature"""
        params = {
            "to": "0x1234567890123456789012345678901234567890",
            "amount": "100",
            "token": "USDC",
            "expiry": 1700000000000,
        }
        secret = "test_secret"

        signature = generate_payment_link_signature(**params, secret=secret)
        assert verify_payment_link_signature(**params, signature=signature, secret=secret) is True

    def test_verify_signature_invalid(self):
        """Should reject invalid payment link signature"""
        assert (
            verify_payment_link_signature(
                to="0x1234567890123456789012345678901234567890",
                amount="100",
                token="USDC",
                expiry=1700000000000,
                signature="invalid",
                secret="test_secret",
            )
            is False
        )

    def test_signature_case_insensitive_address(self):
        """Should produce same signature regardless of address case"""
        params = {
            "amount": "100",
            "token": "USDC",
            "expiry": 1700000000000,
        }
        secret = "test_secret"

        sig1 = generate_payment_link_signature(
            to="0xABCDEF1234567890123456789012345678901234", **params, secret=secret
        )
        sig2 = generate_payment_link_signature(
            to="0xabcdef1234567890123456789012345678901234", **params, secret=secret
        )
        assert sig1 == sig2


class TestWebhookSignature:
    """Tests for webhook signature"""

    def test_generate_webhook_signature(self):
        """Should generate webhook signature"""
        signature = generate_webhook_signature(
            payload='{"test": "data"}',
            secret="webhook_secret",
            timestamp=1700000000,
        )
        assert len(signature) == 64


class TestSensitiveDataProtection:
    """Tests for sensitive data protection"""

    def test_mask_sensitive_short(self):
        """Should mask short strings completely"""
        result = mask_sensitive("abc")
        assert result == "***"

    def test_mask_sensitive_long(self):
        """Should mask middle of long strings"""
        result = mask_sensitive("1234567890123456")
        assert result.startswith("1234")
        assert result.endswith("3456")
        assert "*" in result

    def test_sanitize_for_logging(self):
        """Should sanitize sensitive fields"""
        obj = {
            "apiKey": "pk_live_secret123",
            "amount": "100",
            "nested": {"password": "secret"},
        }
        result = sanitize_for_logging(obj)

        assert "*" in result["apiKey"]
        assert result["amount"] == "100"
        assert "*" in result["nested"]["password"] or result["nested"]["password"] == "[REDACTED]"
