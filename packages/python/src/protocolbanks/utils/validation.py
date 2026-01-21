"""
ProtocolBanks SDK - Input Validation

地址验证、金额验证、同形字符检测
Supports: Ethereum, Solana, Bitcoin addresses
"""

from __future__ import annotations

import re
import time
from typing import Any

from protocolbanks.config import MAX_AMOUNT, MAX_BATCH_SIZE, MAX_EXPIRY_HOURS, MIN_AMOUNT
from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import ChainId, ErrorCodes, HomoglyphDetails, TokenSymbol


# ============================================================================
# Homoglyph Detection
# ============================================================================

# Cyrillic characters that look like Latin characters
CYRILLIC_HOMOGLYPHS: dict[str, str] = {
    "а": "a",  # Cyrillic а -> Latin a
    "е": "e",  # Cyrillic е -> Latin e
    "о": "o",  # Cyrillic о -> Latin o
    "р": "p",  # Cyrillic р -> Latin p
    "с": "c",  # Cyrillic с -> Latin c
    "х": "x",  # Cyrillic х -> Latin x
    "у": "y",  # Cyrillic у -> Latin y
    "А": "A",  # Cyrillic А -> Latin A
    "В": "B",  # Cyrillic В -> Latin B
    "Е": "E",  # Cyrillic Е -> Latin E
    "К": "K",  # Cyrillic К -> Latin K
    "М": "M",  # Cyrillic М -> Latin M
    "Н": "H",  # Cyrillic Н -> Latin H
    "О": "O",  # Cyrillic О -> Latin O
    "Р": "P",  # Cyrillic Р -> Latin P
    "С": "C",  # Cyrillic С -> Latin C
    "Т": "T",  # Cyrillic Т -> Latin T
    "Х": "X",  # Cyrillic Х -> Latin X
}

# Greek characters that look like Latin characters
GREEK_HOMOGLYPHS: dict[str, str] = {
    "Α": "A",  # Greek Alpha -> Latin A
    "Β": "B",  # Greek Beta -> Latin B
    "Ε": "E",  # Greek Epsilon -> Latin E
    "Ζ": "Z",  # Greek Zeta -> Latin Z
    "Η": "H",  # Greek Eta -> Latin H
    "Ι": "I",  # Greek Iota -> Latin I
    "Κ": "K",  # Greek Kappa -> Latin K
    "Μ": "M",  # Greek Mu -> Latin M
    "Ν": "N",  # Greek Nu -> Latin N
    "Ο": "O",  # Greek Omicron -> Latin O
    "Ρ": "P",  # Greek Rho -> Latin P
    "Τ": "T",  # Greek Tau -> Latin T
    "Υ": "Y",  # Greek Upsilon -> Latin Y
    "Χ": "X",  # Greek Chi -> Latin X
    "ο": "o",  # Greek omicron -> Latin o
}

# All homoglyphs combined
ALL_HOMOGLYPHS: dict[str, str] = {**CYRILLIC_HOMOGLYPHS, **GREEK_HOMOGLYPHS}


def detect_homoglyphs(input_str: str) -> HomoglyphDetails | None:
    """Detect homoglyph characters in a string"""
    detected_characters: list[dict[str, Any]] = []

    for i, char in enumerate(input_str):
        expected = ALL_HOMOGLYPHS.get(char)
        if expected:
            detected_characters.append(
                {
                    "position": i,
                    "character": char,
                    "unicode_point": f"U+{ord(char):04X}",
                    "expected_character": expected,
                }
            )

    if not detected_characters:
        return None

    return HomoglyphDetails(
        original_address=input_str,
        detected_characters=detected_characters,
    )


def contains_homoglyphs(input_str: str) -> bool:
    """Check if string contains homoglyphs"""
    return detect_homoglyphs(input_str) is not None


def normalize_homoglyphs(input_str: str) -> str:
    """Normalize string by replacing homoglyphs with Latin equivalents"""
    result = ""
    for char in input_str:
        result += ALL_HOMOGLYPHS.get(char, char)
    return result


# ============================================================================
# Address Validation
# ============================================================================

# EVM address pattern (0x + 40 hex chars)
EVM_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")

# Solana address pattern (Base58, 32-44 chars)
SOLANA_ADDRESS_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")

# Bitcoin address patterns
BITCOIN_PATTERNS = {
    "legacy": re.compile(r"^1[a-km-zA-HJ-NP-Z1-9]{25,34}$"),  # P2PKH
    "segwit": re.compile(r"^3[a-km-zA-HJ-NP-Z1-9]{25,34}$"),  # P2SH
    "bech32": re.compile(r"^bc1[a-z0-9]{39,59}$"),  # Native SegWit
    "taproot": re.compile(r"^bc1p[a-z0-9]{58}$"),  # Taproot
}


def is_valid_evm_address(address: str) -> bool:
    """Validate EVM address (Ethereum, Polygon, etc.)"""
    if contains_homoglyphs(address):
        return False
    return bool(EVM_ADDRESS_PATTERN.match(address))


def is_valid_solana_address(address: str) -> bool:
    """Validate Solana address"""
    if contains_homoglyphs(address):
        return False
    return bool(SOLANA_ADDRESS_PATTERN.match(address))


def is_valid_bitcoin_address(address: str) -> bool:
    """Validate Bitcoin address"""
    if contains_homoglyphs(address):
        return False
    return any(pattern.match(address) for pattern in BITCOIN_PATTERNS.values())


def is_valid_address(address: str, chain_id: ChainId | None = None) -> bool:
    """Validate address for a specific chain"""
    if contains_homoglyphs(address):
        return False

    if chain_id == "solana":
        return is_valid_solana_address(address)

    if chain_id == "bitcoin":
        return is_valid_bitcoin_address(address)

    # Default to EVM validation
    return is_valid_evm_address(address)


def validate_address(address: str, chain_id: ChainId | None = None) -> None:
    """Validate address and throw error if invalid"""
    # Check for homoglyphs
    homoglyph_details = detect_homoglyphs(address)
    if homoglyph_details:
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_HOMOGLYPH_DETECTED,
            message="Potential homoglyph attack detected in address",
            details=homoglyph_details.model_dump(),
            retryable=False,
        )

    # Validate format
    if not is_valid_address(address, chain_id):
        chain_name = (
            "Solana" if chain_id == "solana" else "Bitcoin" if chain_id == "bitcoin" else "EVM"
        )
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_ADDRESS,
            message=f"Invalid {chain_name} address format",
            details={"address": address, "chain_id": chain_id},
            retryable=False,
        )


def get_address_type(address: str) -> str:
    """Get address type"""
    if is_valid_evm_address(address):
        return "evm"
    if is_valid_solana_address(address):
        return "solana"
    if is_valid_bitcoin_address(address):
        return "bitcoin"
    return "unknown"


# ============================================================================
# Amount Validation
# ============================================================================


def is_valid_amount(amount: str) -> bool:
    """Validate payment amount"""
    try:
        num = float(amount)
        if num <= 0:
            return False
        if num < float(MIN_AMOUNT):
            return False
        if num > float(MAX_AMOUNT):
            return False

        # Check for reasonable decimal places (max 18)
        parts = amount.split(".")
        if len(parts) > 1 and len(parts[1]) > 18:
            return False

        return True
    except (ValueError, TypeError):
        return False


def validate_amount(amount: str) -> None:
    """Validate amount and throw error if invalid"""
    try:
        num = float(amount)
    except (ValueError, TypeError):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_AMOUNT,
            message="Amount must be a valid number",
            details={"amount": amount},
            retryable=False,
        )

    if num <= 0:
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_AMOUNT,
            message="Amount must be greater than 0",
            details={"amount": amount},
            retryable=False,
        )

    if num < float(MIN_AMOUNT):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_AMOUNT,
            message=f"Amount must be at least {MIN_AMOUNT}",
            details={"amount": amount, "min_amount": MIN_AMOUNT},
            retryable=False,
        )

    if num > float(MAX_AMOUNT):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_AMOUNT,
            message=f"Amount must not exceed {MAX_AMOUNT}",
            details={"amount": amount, "max_amount": MAX_AMOUNT},
            retryable=False,
        )


# ============================================================================
# Token Validation
# ============================================================================

SUPPORTED_TOKENS: list[TokenSymbol] = ["USDC", "USDT", "DAI", "ETH", "MATIC", "BNB", "SOL", "BTC"]


def is_valid_token(token: str) -> bool:
    """Validate token symbol"""
    return token.upper() in SUPPORTED_TOKENS


def validate_token(token: str) -> None:
    """Validate token and throw error if invalid"""
    if not is_valid_token(token):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_TOKEN,
            message=f"Unsupported token: {token}",
            details={"token": token, "supported_tokens": SUPPORTED_TOKENS},
            retryable=False,
        )


# ============================================================================
# Chain Validation
# ============================================================================

SUPPORTED_CHAIN_IDS: list[ChainId] = [1, 137, 8453, 42161, 10, 56, "solana", "bitcoin"]


def is_valid_chain_id(chain_id: Any) -> bool:
    """Validate chain ID"""
    return chain_id in SUPPORTED_CHAIN_IDS


def validate_chain_id(chain_id: Any) -> None:
    """Validate chain and throw error if invalid"""
    if not is_valid_chain_id(chain_id):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_CHAIN,
            message=f"Unsupported chain: {chain_id}",
            details={"chain_id": chain_id, "supported_chains": SUPPORTED_CHAIN_IDS},
            retryable=False,
        )


# ============================================================================
# Expiry Validation
# ============================================================================


def is_valid_expiry_hours(hours: int) -> bool:
    """Validate expiry hours"""
    return isinstance(hours, int) and 1 <= hours <= MAX_EXPIRY_HOURS


def validate_expiry_hours(hours: int) -> None:
    """Validate expiry and throw error if invalid"""
    if not is_valid_expiry_hours(hours):
        raise ProtocolBanksError(
            code=ErrorCodes.LINK_INVALID_EXPIRY,
            message=f"Expiry hours must be between 1 and {MAX_EXPIRY_HOURS}",
            details={"hours": hours, "max_hours": MAX_EXPIRY_HOURS},
            retryable=False,
        )


def is_expired(expiry_timestamp: int) -> bool:
    """Check if timestamp is expired"""
    return int(time.time() * 1000) > expiry_timestamp


# ============================================================================
# Batch Validation
# ============================================================================


def is_valid_batch_size(size: int) -> bool:
    """Validate batch size"""
    return isinstance(size, int) and 1 <= size <= MAX_BATCH_SIZE


def validate_batch_size(size: int) -> None:
    """Validate batch size and throw error if invalid"""
    if not is_valid_batch_size(size):
        raise ProtocolBanksError(
            code=ErrorCodes.BATCH_SIZE_EXCEEDED,
            message=f"Batch size must be between 1 and {MAX_BATCH_SIZE}",
            details={"size": size, "max_size": MAX_BATCH_SIZE},
            retryable=False,
        )


# ============================================================================
# URL Validation
# ============================================================================


def is_https_url(url: str) -> bool:
    """Validate URL is HTTPS"""
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.scheme == "https"
    except Exception:
        return False


def validate_https_url(url: str, field_name: str = "URL") -> None:
    """Validate URL and throw error if not HTTPS"""
    if not is_https_url(url):
        raise ProtocolBanksError(
            code=ErrorCodes.VALID_INVALID_FORMAT,
            message=f"{field_name} must be a valid HTTPS URL",
            details={"url": url, "field_name": field_name},
            retryable=False,
        )


# ============================================================================
# API Key Validation
# ============================================================================

API_KEY_PATTERN = re.compile(r"^pk_(live|test|sandbox)_[a-zA-Z0-9]{24,}$")
API_SECRET_PATTERN = re.compile(r"^sk_(live|test|sandbox)_[a-zA-Z0-9]{32,}$")


def is_valid_api_key(api_key: str) -> bool:
    """Validate API key format"""
    return bool(API_KEY_PATTERN.match(api_key))


def is_valid_api_secret(api_secret: str) -> bool:
    """Validate API secret format"""
    return bool(API_SECRET_PATTERN.match(api_secret))


def validate_api_credentials(api_key: str, api_secret: str) -> None:
    """Validate API credentials"""
    if not is_valid_api_key(api_key):
        raise ProtocolBanksError(
            code=ErrorCodes.AUTH_INVALID_API_KEY,
            message="Invalid API key format",
            retryable=False,
        )

    if not is_valid_api_secret(api_secret):
        raise ProtocolBanksError(
            code=ErrorCodes.AUTH_INVALID_SECRET,
            message="Invalid API secret format",
            retryable=False,
        )


# ============================================================================
# Memo Validation
# ============================================================================

MAX_MEMO_LENGTH = 256


def is_valid_memo(memo: str) -> bool:
    """Validate memo"""
    return len(memo) <= MAX_MEMO_LENGTH


def validate_memo(memo: str) -> None:
    """Validate memo and throw error if invalid"""
    if not is_valid_memo(memo):
        raise ProtocolBanksError(
            code=ErrorCodes.VALID_OUT_OF_RANGE,
            message=f"Memo must not exceed {MAX_MEMO_LENGTH} characters",
            details={"length": len(memo), "max_length": MAX_MEMO_LENGTH},
            retryable=False,
        )
