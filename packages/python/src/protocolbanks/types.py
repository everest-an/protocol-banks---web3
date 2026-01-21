"""
ProtocolBanks SDK - Core Type Definitions

支持多链、多币种的加密货币收单 SDK
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Union

from pydantic import BaseModel, Field


# ============================================================================
# Chain & Token Types
# ============================================================================

ChainId = Union[Literal[1, 137, 8453, 42161, 10, 56], Literal["solana", "bitcoin"]]
"""Supported chain IDs"""

TokenSymbol = Literal["USDC", "USDT", "DAI", "ETH", "MATIC", "BNB", "SOL", "BTC"]
"""Supported token symbols"""

Environment = Literal["production", "sandbox", "testnet"]
"""SDK environment"""


class ChainConfig(BaseModel):
    """Chain configuration"""

    id: ChainId
    name: str
    native_currency: TokenSymbol
    rpc_url: str
    explorer_url: str
    tokens: list["TokenConfig"]
    is_testnet: bool = False


class TokenConfig(BaseModel):
    """Token configuration"""

    symbol: TokenSymbol
    name: str
    address: str  # Contract address or 'native'
    decimals: int
    supports_gasless: bool = False  # x402 support
    min_amount: str | None = None
    max_amount: str | None = None


# ============================================================================
# SDK Configuration Types
# ============================================================================


class RetryConfig(BaseModel):
    """Retry configuration"""

    max_retries: int = 3
    initial_delay: float = 1.0  # seconds
    max_delay: float = 30.0  # seconds
    backoff_multiplier: float = 2.0


class ProtocolBanksConfig(BaseModel):
    """Main SDK configuration"""

    api_key: str
    api_secret: str
    environment: Environment = "production"
    base_url: str | None = None
    timeout: float = 30.0  # seconds
    retry_config: RetryConfig | None = None
    default_chain: ChainId | None = None
    supported_chains: list[ChainId] | None = None
    supported_tokens: list[TokenSymbol] | None = None


# ============================================================================
# Payment Link Types
# ============================================================================


class PaymentLinkParams(BaseModel):
    """Payment link generation parameters"""

    to: str  # Recipient address
    amount: str  # Amount in token units
    token: TokenSymbol | None = "USDC"
    chain: ChainId | None = None
    expiry_hours: int | None = 24  # Default: 24, max: 168
    memo: str | None = None  # Optional reference (max 256 chars)
    order_id: str | None = None  # Merchant order ID
    callback_url: str | None = None  # Redirect URL after payment
    webhook_url: str | None = None  # Webhook notification URL
    allowed_chains: list[ChainId] | None = None
    allowed_tokens: list[TokenSymbol] | None = None
    metadata: dict[str, str] | None = None


class PaymentLink(BaseModel):
    """Generated payment link"""

    url: str
    short_url: str
    params: PaymentLinkParams
    signature: str
    expires_at: datetime
    created_at: datetime
    payment_id: str


class HomoglyphDetails(BaseModel):
    """Homoglyph attack detection details"""

    original_address: str
    detected_characters: list[dict[str, Any]]


class LinkVerificationResult(BaseModel):
    """Link verification result"""

    valid: bool
    expired: bool
    tampered_fields: list[str]
    params: PaymentLinkParams | None = None
    error: str | None = None
    homoglyph_detected: bool | None = None
    homoglyph_details: HomoglyphDetails | None = None


# ============================================================================
# QR Code Types
# ============================================================================

QRErrorCorrection = Literal["L", "M", "Q", "H"]
QRFormat = Literal["svg", "png", "base64", "dataUrl"]


class QROptions(BaseModel):
    """QR code generation options"""

    size: int = 300  # 100-1000 pixels
    format: QRFormat = "svg"
    error_correction: QRErrorCorrection = "M"
    logo: str | None = None  # Logo URL or base64
    logo_size: float = 0.2  # 0.1-0.3 ratio
    foreground: str = "#000000"  # Hex color
    background: str = "#ffffff"  # Hex color
    margin: int = 4  # Quiet zone modules


class QRCode(BaseModel):
    """Generated QR code"""

    data: str
    format: QRFormat
    size: int
    payment_link: str


# ============================================================================
# x402 Gasless Payment Types
# ============================================================================

X402Status = Literal[
    "pending", "signed", "submitted", "executed", "failed", "expired", "cancelled"
]


class EIP712Domain(BaseModel):
    """EIP-712 domain"""

    name: str
    version: str
    chain_id: int
    verifying_contract: str


class EIP712Types(BaseModel):
    """EIP-712 types"""

    types: dict[str, list[dict[str, str]]]


class TransferWithAuthorizationMessage(BaseModel):
    """TransferWithAuthorization message"""

    from_address: str = Field(alias="from")
    to: str
    value: str
    valid_after: int
    valid_before: int
    nonce: str

    model_config = {"populate_by_name": True}


class X402AuthorizationParams(BaseModel):
    """x402 authorization parameters"""

    to: str
    amount: str
    token: TokenSymbol
    chain_id: int
    valid_for: int | None = 3600  # Seconds, default: 1 hour


class X402Authorization(BaseModel):
    """x402 authorization"""

    id: str
    domain: EIP712Domain
    types: dict[str, list[dict[str, str]]]
    message: TransferWithAuthorizationMessage
    status: X402Status
    transaction_hash: str | None = None
    created_at: datetime
    expires_at: datetime
    signature: str | None = None
    relayer_fee: str | None = None


# ============================================================================
# Batch Payment Types
# ============================================================================


class BatchRecipient(BaseModel):
    """Batch recipient"""

    address: str
    amount: str
    token: TokenSymbol
    memo: str | None = None
    order_id: str | None = None


class BatchValidationError(BaseModel):
    """Batch validation error"""

    index: int
    address: str
    errors: list[str]


class BatchItemStatus(BaseModel):
    """Batch item status"""

    index: int
    address: str
    amount: str
    status: Literal["pending", "processing", "completed", "failed"]
    transaction_hash: str | None = None
    error: str | None = None


class BatchOptions(BaseModel):
    """Batch submit options"""

    chain: ChainId | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    webhook_url: str | None = None
    idempotency_key: str | None = None


class BatchSubmitResult(BaseModel):
    """Batch submit result"""

    batch_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    valid_count: int
    invalid_count: int
    errors: list[BatchValidationError]
    estimated_fee: str | None = None


class BatchProgress(BaseModel):
    """Batch progress"""

    total: int
    completed: int
    failed: int
    pending: int


class BatchStatus(BaseModel):
    """Batch status"""

    batch_id: str
    status: str
    progress: BatchProgress
    items: list[BatchItemStatus]
    total_amount: str
    total_fee: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


# ============================================================================
# Webhook Types
# ============================================================================

WebhookEventType = Literal[
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


class WebhookEvent(BaseModel):
    """Webhook event"""

    id: str
    type: WebhookEventType
    timestamp: datetime
    data: dict[str, Any]
    signature: str = ""


class WebhookVerificationResult(BaseModel):
    """Webhook verification result"""

    valid: bool
    event: WebhookEvent | None = None
    error: str | None = None
    timestamp_valid: bool | None = None


# ============================================================================
# Error Types
# ============================================================================


class ErrorCategory(str, Enum):
    """Error categories"""

    AUTH = "AUTH"  # Authentication errors
    LINK = "LINK"  # Payment link errors
    X402 = "X402"  # x402 protocol errors
    BATCH = "BATCH"  # Batch payment errors
    NET = "NET"  # Network errors
    RATE = "RATE"  # Rate limit errors
    VALID = "VALID"  # Validation errors
    CRYPTO = "CRYPTO"  # Cryptography errors
    CHAIN = "CHAIN"  # Blockchain errors


class SDKError(BaseModel):
    """SDK Error"""

    code: str  # Format: PB_{CATEGORY}_{NNN}
    category: ErrorCategory
    message: str
    details: Any | None = None
    retryable: bool = False
    retry_after: int | None = None  # Seconds
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: str | None = None


class ErrorCodes:
    """Error code constants"""

    # Authentication errors (PB_AUTH_xxx)
    AUTH_INVALID_API_KEY = "PB_AUTH_001"
    AUTH_INVALID_SECRET = "PB_AUTH_002"
    AUTH_TOKEN_EXPIRED = "PB_AUTH_003"
    AUTH_TOKEN_INVALID = "PB_AUTH_004"
    AUTH_INSUFFICIENT_PERMISSIONS = "PB_AUTH_005"

    # Payment link errors (PB_LINK_xxx)
    LINK_INVALID_ADDRESS = "PB_LINK_001"
    LINK_INVALID_AMOUNT = "PB_LINK_002"
    LINK_INVALID_TOKEN = "PB_LINK_003"
    LINK_INVALID_CHAIN = "PB_LINK_004"
    LINK_EXPIRED = "PB_LINK_005"
    LINK_TAMPERED = "PB_LINK_006"
    LINK_HOMOGLYPH_DETECTED = "PB_LINK_007"
    LINK_INVALID_EXPIRY = "PB_LINK_008"

    # x402 errors (PB_X402_xxx)
    X402_UNSUPPORTED_CHAIN = "PB_X402_001"
    X402_UNSUPPORTED_TOKEN = "PB_X402_002"
    X402_AUTHORIZATION_EXPIRED = "PB_X402_003"
    X402_INVALID_SIGNATURE = "PB_X402_004"
    X402_NONCE_REUSED = "PB_X402_005"
    X402_INSUFFICIENT_BALANCE = "PB_X402_006"
    X402_RELAYER_ERROR = "PB_X402_007"

    # Batch errors (PB_BATCH_xxx)
    BATCH_SIZE_EXCEEDED = "PB_BATCH_001"
    BATCH_VALIDATION_FAILED = "PB_BATCH_002"
    BATCH_NOT_FOUND = "PB_BATCH_003"
    BATCH_ALREADY_PROCESSING = "PB_BATCH_004"

    # Network errors (PB_NET_xxx)
    NET_CONNECTION_FAILED = "PB_NET_001"
    NET_TIMEOUT = "PB_NET_002"
    NET_DNS_FAILED = "PB_NET_003"
    NET_SSL_ERROR = "PB_NET_004"

    # Rate limit errors (PB_RATE_xxx)
    RATE_LIMIT_EXCEEDED = "PB_RATE_001"
    RATE_QUOTA_EXCEEDED = "PB_RATE_002"

    # Validation errors (PB_VALID_xxx)
    VALID_REQUIRED_FIELD = "PB_VALID_001"
    VALID_INVALID_FORMAT = "PB_VALID_002"
    VALID_OUT_OF_RANGE = "PB_VALID_003"

    # Cryptography errors (PB_CRYPTO_xxx)
    CRYPTO_ENCRYPTION_FAILED = "PB_CRYPTO_001"
    CRYPTO_DECRYPTION_FAILED = "PB_CRYPTO_002"
    CRYPTO_SIGNATURE_FAILED = "PB_CRYPTO_003"
    CRYPTO_KEY_DERIVATION_FAILED = "PB_CRYPTO_004"

    # Chain errors (PB_CHAIN_xxx)
    CHAIN_UNSUPPORTED = "PB_CHAIN_001"
    CHAIN_RPC_ERROR = "PB_CHAIN_002"
    CHAIN_TRANSACTION_FAILED = "PB_CHAIN_003"
