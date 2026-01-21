"""
ProtocolBanks SDK - Cryptography Utilities

安全加密工具，支持:
- HMAC-SHA256 签名生成和验证
- 常量时间比较 (防时序攻击)
- 安全随机数生成
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import uuid
from typing import Any


# ============================================================================
# Random Generation
# ============================================================================


def random_bytes(size: int) -> bytes:
    """Generate secure random bytes"""
    return secrets.token_bytes(size)


def random_hex(size: int) -> str:
    """Generate random hex string"""
    return secrets.token_hex(size)


def generate_uuid() -> str:
    """Generate UUID v4"""
    return str(uuid.uuid4())


def generate_nonce() -> str:
    """Generate nonce for x402 (32 bytes)"""
    return "0x" + random_hex(32)


# ============================================================================
# HMAC-SHA256 Signature
# ============================================================================


def hmac_sign(data: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature"""
    signature = hmac.new(
        secret.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    )
    return signature.hexdigest()


def hmac_sign_short(data: str, secret: str) -> str:
    """Generate truncated HMAC signature (16 chars)"""
    full_signature = hmac_sign(data, secret)
    return full_signature[:16]


def hmac_verify(data: str, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 signature (constant time)"""
    expected_signature = hmac_sign(data, secret)
    return constant_time_equal(signature, expected_signature)


def hmac_verify_short(data: str, signature: str, secret: str) -> bool:
    """Verify truncated HMAC signature (constant time)"""
    expected_signature = hmac_sign_short(data, secret)
    return constant_time_equal(signature, expected_signature)


# ============================================================================
# Constant Time Comparison
# ============================================================================


def constant_time_equal(a: str, b: str) -> bool:
    """Constant-time string comparison (prevents timing attacks)"""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def constant_time_equal_bytes(a: bytes, b: bytes) -> bool:
    """Constant-time bytes comparison"""
    return hmac.compare_digest(a, b)


# ============================================================================
# SHA-256 Hash
# ============================================================================


def sha256(data: str) -> str:
    """Calculate SHA-256 hash"""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> bytes:
    """Calculate SHA-256 hash of bytes"""
    return hashlib.sha256(data).digest()


# ============================================================================
# Payment Link Signature
# ============================================================================


def generate_payment_link_signature(
    to: str,
    amount: str,
    token: str,
    expiry: int,
    secret: str,
    memo: str | None = None,
) -> str:
    """Generate payment link signature"""
    # Normalize parameters
    normalized = {
        "amount": amount,
        "expiry": str(expiry),
        "memo": memo or "",
        "to": to.lower(),
        "token": token.upper(),
    }

    # Create canonical string (sorted keys)
    data_to_sign = "&".join(f"{k}={v}" for k, v in sorted(normalized.items()))

    return hmac_sign_short(data_to_sign, secret)


def verify_payment_link_signature(
    to: str,
    amount: str,
    token: str,
    expiry: int,
    signature: str,
    secret: str,
    memo: str | None = None,
) -> bool:
    """Verify payment link signature"""
    expected_signature = generate_payment_link_signature(
        to=to,
        amount=amount,
        token=token,
        expiry=expiry,
        secret=secret,
        memo=memo,
    )
    return constant_time_equal(signature, expected_signature)


# ============================================================================
# Webhook Signature
# ============================================================================


def generate_webhook_signature(payload: str, secret: str, timestamp: int) -> str:
    """Generate webhook signature"""
    data_to_sign = f"{timestamp}.{payload}"
    return hmac_sign(data_to_sign, secret)


def verify_webhook_signature(
    payload: str,
    signature: str,
    secret: str,
    timestamp: int,
    tolerance: int = 300,  # 5 minutes
) -> tuple[bool, bool]:
    """
    Verify webhook signature

    Returns:
        Tuple of (valid, timestamp_valid)
    """
    import time

    now = int(time.time())
    timestamp_valid = abs(now - timestamp) <= tolerance

    expected_signature = generate_webhook_signature(payload, secret, timestamp)
    valid = constant_time_equal(signature, expected_signature)

    return (valid and timestamp_valid, timestamp_valid)


# ============================================================================
# Sensitive Data Protection
# ============================================================================


def mask_sensitive(value: str, show_first: int = 4, show_last: int = 4) -> str:
    """Mask sensitive string (show first/last N chars)"""
    if len(value) <= show_first + show_last:
        return "*" * len(value)

    first = value[:show_first]
    last = value[-show_last:]
    masked = "*" * min(len(value) - show_first - show_last, 8)

    return f"{first}{masked}{last}"


def is_sensitive_data(value: str) -> bool:
    """Check if string looks like sensitive data"""
    patterns = [
        r"^pk_[a-z]+_[a-zA-Z0-9]+$",  # API key
        r"^sk_[a-z]+_[a-zA-Z0-9]+$",  # API secret
        r"^whsec_[a-zA-Z0-9]+$",  # Webhook secret
        r"^0x[a-fA-F0-9]{64}$",  # Private key
        r"^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$",  # JWT
    ]

    return any(re.match(pattern, value) for pattern in patterns)


def sanitize_for_logging(obj: dict[str, Any]) -> dict[str, Any]:
    """Sanitize object for logging (mask sensitive fields)"""
    sensitive_fields = [
        "apikey",
        "apisecret",
        "secret",
        "password",
        "token",
        "accesstoken",
        "refreshtoken",
        "privatekey",
        "signature",
    ]

    result: dict[str, Any] = {}

    for key, value in obj.items():
        key_lower = key.lower().replace("_", "")

        if any(f in key_lower for f in sensitive_fields):
            result[key] = mask_sensitive(str(value)) if isinstance(value, str) else "[REDACTED]"
        elif isinstance(value, str) and is_sensitive_data(value):
            result[key] = mask_sensitive(value)
        elif isinstance(value, dict):
            result[key] = sanitize_for_logging(value)
        else:
            result[key] = value

    return result
