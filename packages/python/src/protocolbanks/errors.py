"""
ProtocolBanks SDK - Error Handling System

统一错误处理，支持:
- 错误码格式 (PB_XXX_NNN)
- 错误本地化 (英文/中文)
- 可重试判断
- 错误详情
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from protocolbanks.types import ErrorCategory, ErrorCodes, SDKError


# ============================================================================
# Error Messages (Localized)
# ============================================================================

ERROR_MESSAGES_EN: dict[str, str] = {
    # Authentication errors
    ErrorCodes.AUTH_INVALID_API_KEY: "Invalid API key",
    ErrorCodes.AUTH_INVALID_SECRET: "Invalid API secret",
    ErrorCodes.AUTH_TOKEN_EXPIRED: "Authentication token has expired",
    ErrorCodes.AUTH_TOKEN_INVALID: "Invalid authentication token",
    ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS: "Insufficient permissions for this operation",
    # Payment link errors
    ErrorCodes.LINK_INVALID_ADDRESS: "Invalid recipient address format",
    ErrorCodes.LINK_INVALID_AMOUNT: "Invalid payment amount",
    ErrorCodes.LINK_INVALID_TOKEN: "Unsupported token",
    ErrorCodes.LINK_INVALID_CHAIN: "Unsupported blockchain",
    ErrorCodes.LINK_EXPIRED: "Payment link has expired",
    ErrorCodes.LINK_TAMPERED: "Payment link has been tampered with",
    ErrorCodes.LINK_HOMOGLYPH_DETECTED: "Potential homoglyph attack detected in address",
    ErrorCodes.LINK_INVALID_EXPIRY: "Invalid expiry time",
    # x402 errors
    ErrorCodes.X402_UNSUPPORTED_CHAIN: "Chain does not support gasless payments",
    ErrorCodes.X402_UNSUPPORTED_TOKEN: "Token does not support gasless payments",
    ErrorCodes.X402_AUTHORIZATION_EXPIRED: "Authorization has expired",
    ErrorCodes.X402_INVALID_SIGNATURE: "Invalid authorization signature",
    ErrorCodes.X402_NONCE_REUSED: "Nonce has already been used",
    ErrorCodes.X402_INSUFFICIENT_BALANCE: "Insufficient token balance",
    ErrorCodes.X402_RELAYER_ERROR: "Relayer service error",
    # Batch errors
    ErrorCodes.BATCH_SIZE_EXCEEDED: "Batch size exceeds maximum limit of 500",
    ErrorCodes.BATCH_VALIDATION_FAILED: "Batch validation failed",
    ErrorCodes.BATCH_NOT_FOUND: "Batch not found",
    ErrorCodes.BATCH_ALREADY_PROCESSING: "Batch is already being processed",
    # Network errors
    ErrorCodes.NET_CONNECTION_FAILED: "Network connection failed",
    ErrorCodes.NET_TIMEOUT: "Request timed out",
    ErrorCodes.NET_DNS_FAILED: "DNS resolution failed",
    ErrorCodes.NET_SSL_ERROR: "SSL/TLS error",
    # Rate limit errors
    ErrorCodes.RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
    ErrorCodes.RATE_QUOTA_EXCEEDED: "API quota exceeded",
    # Validation errors
    ErrorCodes.VALID_REQUIRED_FIELD: "Required field is missing",
    ErrorCodes.VALID_INVALID_FORMAT: "Invalid field format",
    ErrorCodes.VALID_OUT_OF_RANGE: "Value is out of allowed range",
    # Cryptography errors
    ErrorCodes.CRYPTO_ENCRYPTION_FAILED: "Encryption failed",
    ErrorCodes.CRYPTO_DECRYPTION_FAILED: "Decryption failed",
    ErrorCodes.CRYPTO_SIGNATURE_FAILED: "Signature generation failed",
    ErrorCodes.CRYPTO_KEY_DERIVATION_FAILED: "Key derivation failed",
    # Chain errors
    ErrorCodes.CHAIN_UNSUPPORTED: "Blockchain not supported",
    ErrorCodes.CHAIN_RPC_ERROR: "Blockchain RPC error",
    ErrorCodes.CHAIN_TRANSACTION_FAILED: "Transaction failed",
}

ERROR_MESSAGES_ZH: dict[str, str] = {
    # Authentication errors
    ErrorCodes.AUTH_INVALID_API_KEY: "API 密钥无效",
    ErrorCodes.AUTH_INVALID_SECRET: "API 密钥密码无效",
    ErrorCodes.AUTH_TOKEN_EXPIRED: "认证令牌已过期",
    ErrorCodes.AUTH_TOKEN_INVALID: "认证令牌无效",
    ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS: "权限不足",
    # Payment link errors
    ErrorCodes.LINK_INVALID_ADDRESS: "收款地址格式无效",
    ErrorCodes.LINK_INVALID_AMOUNT: "支付金额无效",
    ErrorCodes.LINK_INVALID_TOKEN: "不支持的代币",
    ErrorCodes.LINK_INVALID_CHAIN: "不支持的区块链",
    ErrorCodes.LINK_EXPIRED: "支付链接已过期",
    ErrorCodes.LINK_TAMPERED: "支付链接已被篡改",
    ErrorCodes.LINK_HOMOGLYPH_DETECTED: "检测到地址中可能存在同形字符攻击",
    ErrorCodes.LINK_INVALID_EXPIRY: "过期时间无效",
    # x402 errors
    ErrorCodes.X402_UNSUPPORTED_CHAIN: "该链不支持免 Gas 支付",
    ErrorCodes.X402_UNSUPPORTED_TOKEN: "该代币不支持免 Gas 支付",
    ErrorCodes.X402_AUTHORIZATION_EXPIRED: "授权已过期",
    ErrorCodes.X402_INVALID_SIGNATURE: "授权签名无效",
    ErrorCodes.X402_NONCE_REUSED: "Nonce 已被使用",
    ErrorCodes.X402_INSUFFICIENT_BALANCE: "代币余额不足",
    ErrorCodes.X402_RELAYER_ERROR: "中继服务错误",
    # Batch errors
    ErrorCodes.BATCH_SIZE_EXCEEDED: "批量大小超过最大限制 500",
    ErrorCodes.BATCH_VALIDATION_FAILED: "批量验证失败",
    ErrorCodes.BATCH_NOT_FOUND: "批次未找到",
    ErrorCodes.BATCH_ALREADY_PROCESSING: "批次正在处理中",
    # Network errors
    ErrorCodes.NET_CONNECTION_FAILED: "网络连接失败",
    ErrorCodes.NET_TIMEOUT: "请求超时",
    ErrorCodes.NET_DNS_FAILED: "DNS 解析失败",
    ErrorCodes.NET_SSL_ERROR: "SSL/TLS 错误",
    # Rate limit errors
    ErrorCodes.RATE_LIMIT_EXCEEDED: "请求频率超限",
    ErrorCodes.RATE_QUOTA_EXCEEDED: "API 配额已用完",
    # Validation errors
    ErrorCodes.VALID_REQUIRED_FIELD: "缺少必填字段",
    ErrorCodes.VALID_INVALID_FORMAT: "字段格式无效",
    ErrorCodes.VALID_OUT_OF_RANGE: "值超出允许范围",
    # Cryptography errors
    ErrorCodes.CRYPTO_ENCRYPTION_FAILED: "加密失败",
    ErrorCodes.CRYPTO_DECRYPTION_FAILED: "解密失败",
    ErrorCodes.CRYPTO_SIGNATURE_FAILED: "签名生成失败",
    ErrorCodes.CRYPTO_KEY_DERIVATION_FAILED: "密钥派生失败",
    # Chain errors
    ErrorCodes.CHAIN_UNSUPPORTED: "不支持的区块链",
    ErrorCodes.CHAIN_RPC_ERROR: "区块链 RPC 错误",
    ErrorCodes.CHAIN_TRANSACTION_FAILED: "交易失败",
}


# ============================================================================
# Error Class
# ============================================================================


class ProtocolBanksError(Exception):
    """ProtocolBanks SDK Error"""

    def __init__(
        self,
        code: str,
        message: str | None = None,
        category: ErrorCategory | None = None,
        details: Any = None,
        retryable: bool | None = None,
        retry_after: int | None = None,
        request_id: str | None = None,
    ):
        self.code = code
        self.category = category or extract_category(code)
        self.message = message or get_error_message(code, "en")
        self.details = details
        self.retryable = retryable if retryable is not None else is_retryable(code)
        self.retry_after = retry_after
        self.timestamp = datetime.now()
        self.request_id = request_id

        super().__init__(self.message)

    def get_localized_message(self, locale: str = "en") -> str:
        """Get localized message"""
        return get_error_message(self.code, locale)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary"""
        return {
            "code": self.code,
            "category": self.category.value if self.category else None,
            "message": self.message,
            "details": self.details,
            "retryable": self.retryable,
            "retry_after": self.retry_after,
            "timestamp": self.timestamp.isoformat(),
            "request_id": self.request_id,
        }

    def to_sdk_error(self) -> SDKError:
        """Convert to SDKError model"""
        return SDKError(
            code=self.code,
            category=self.category or ErrorCategory.NET,
            message=self.message,
            details=self.details,
            retryable=self.retryable,
            retry_after=self.retry_after,
            timestamp=self.timestamp,
            request_id=self.request_id,
        )

    @classmethod
    def from_exception(
        cls, error: Exception, default_code: str | None = None
    ) -> "ProtocolBanksError":
        """Create from unknown exception"""
        if isinstance(error, ProtocolBanksError):
            return error

        return cls(
            code=default_code or ErrorCodes.NET_CONNECTION_FAILED,
            message=str(error),
            details={"original_error": type(error).__name__},
        )


# ============================================================================
# Helper Functions
# ============================================================================


def get_error_message(code: str, locale: str = "en") -> str:
    """Get error message by code and locale"""
    messages = ERROR_MESSAGES_ZH if locale == "zh" else ERROR_MESSAGES_EN
    return messages.get(code, f"Unknown error: {code}")


def extract_category(code: str) -> ErrorCategory:
    """Extract category from error code"""
    match = re.match(r"^PB_([A-Z]+)_", code)
    if match:
        category_str = match.group(1)
        try:
            return ErrorCategory(category_str)
        except ValueError:
            pass
    return ErrorCategory.NET


def is_retryable(code: str) -> bool:
    """Check if error is retryable"""
    category = extract_category(code)

    # Network and rate limit errors are generally retryable
    if category in (ErrorCategory.NET, ErrorCategory.RATE):
        return True

    # Specific retryable errors
    retryable_codes = [
        ErrorCodes.X402_RELAYER_ERROR,
        ErrorCodes.CHAIN_RPC_ERROR,
    ]

    return code in retryable_codes


def is_valid_error_code(code: str) -> bool:
    """Validate error code format"""
    return bool(re.match(r"^PB_[A-Z]+_[0-9]{3}$", code))


def create_validation_error(
    field: str,
    message: str,
    code: str = ErrorCodes.VALID_INVALID_FORMAT,
) -> ProtocolBanksError:
    """Create validation error"""
    return ProtocolBanksError(
        code=code,
        category=ErrorCategory.VALID,
        message=f"{field}: {message}",
        details={"field": field},
        retryable=False,
    )


def create_auth_error(
    message: str,
    code: str = ErrorCodes.AUTH_INVALID_API_KEY,
) -> ProtocolBanksError:
    """Create authentication error"""
    return ProtocolBanksError(
        code=code,
        category=ErrorCategory.AUTH,
        message=message,
        retryable=False,
    )


def create_network_error(
    message: str,
    code: str = ErrorCodes.NET_CONNECTION_FAILED,
    retry_after: int | None = None,
) -> ProtocolBanksError:
    """Create network error"""
    return ProtocolBanksError(
        code=code,
        category=ErrorCategory.NET,
        message=message,
        retryable=True,
        retry_after=retry_after,
    )
