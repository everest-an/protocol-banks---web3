"""
ProtocolBanks Python SDK

Multi-chain cryptocurrency payment integration SDK.
"""

from protocolbanks.client import ProtocolBanksClient
from protocolbanks.types import (
    # Chain & Token Types
    ChainId,
    TokenSymbol,
    ChainConfig,
    TokenConfig,
    Environment,
    # Payment Link Types
    PaymentLinkParams,
    PaymentLink,
    LinkVerificationResult,
    # QR Code Types
    QROptions,
    QRCode,
    # x402 Types
    X402AuthorizationParams,
    X402Authorization,
    X402Status,
    EIP712Domain,
    TransferWithAuthorizationMessage,
    # Batch Types
    BatchRecipient,
    BatchValidationError,
    BatchSubmitResult,
    BatchStatus,
    # Webhook Types
    WebhookEvent,
    WebhookEventType,
    WebhookVerificationResult,
    # Error Types
    SDKError,
    ErrorCategory,
    ErrorCodes,
    # Config Types
    ProtocolBanksConfig,
    RetryConfig,
)
from protocolbanks.errors import ProtocolBanksError

__version__ = "0.1.0"
__all__ = [
    # Client
    "ProtocolBanksClient",
    # Types
    "ChainId",
    "TokenSymbol",
    "ChainConfig",
    "TokenConfig",
    "Environment",
    "PaymentLinkParams",
    "PaymentLink",
    "LinkVerificationResult",
    "QROptions",
    "QRCode",
    "X402AuthorizationParams",
    "X402Authorization",
    "X402Status",
    "EIP712Domain",
    "TransferWithAuthorizationMessage",
    "BatchRecipient",
    "BatchValidationError",
    "BatchSubmitResult",
    "BatchStatus",
    "WebhookEvent",
    "WebhookEventType",
    "WebhookVerificationResult",
    "SDKError",
    "ErrorCategory",
    "ErrorCodes",
    "ProtocolBanksConfig",
    "RetryConfig",
    # Errors
    "ProtocolBanksError",
]
