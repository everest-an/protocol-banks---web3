"""Tests for validation utilities"""

import pytest

from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import ErrorCodes
from protocolbanks.utils.validation import (
    contains_homoglyphs,
    detect_homoglyphs,
    is_valid_address,
    is_valid_amount,
    is_valid_batch_size,
    is_valid_bitcoin_address,
    is_valid_chain_id,
    is_valid_evm_address,
    is_valid_expiry_hours,
    is_valid_solana_address,
    is_valid_token,
    validate_address,
    validate_amount,
)


class TestHomoglyphDetection:
    """Tests for homoglyph detection"""

    def test_detect_cyrillic_homoglyphs(self):
        """Should detect Cyrillic homoglyphs"""
        # Address with Cyrillic 'а' (U+0430) instead of Latin 'a'
        address = "0x1234567890abcdef1234567890abcdef12345678"
        address_with_cyrillic = address.replace("a", "\u0430")  # Cyrillic а (U+0430)

        result = detect_homoglyphs(address_with_cyrillic)
        assert result is not None
        assert len(result.detected_characters) > 0

    def test_no_homoglyphs_in_valid_address(self):
        """Should not detect homoglyphs in valid address"""
        address = "0x1234567890123456789012345678901234567890"
        result = detect_homoglyphs(address)
        assert result is None

    def test_contains_homoglyphs(self):
        """Should return True for addresses with homoglyphs"""
        address_with_cyrillic = "0x1234567890abcdef1234567890abcdef12345678".replace(
            "a", "\u0430"  # Cyrillic а (U+0430)
        )
        assert contains_homoglyphs(address_with_cyrillic) is True

    def test_no_homoglyphs(self):
        """Should return False for clean addresses"""
        address = "0x1234567890123456789012345678901234567890"
        assert contains_homoglyphs(address) is False


class TestAddressValidation:
    """Tests for address validation"""

    def test_valid_evm_address(self, valid_evm_address: str):
        """Should validate correct EVM address"""
        assert is_valid_evm_address(valid_evm_address) is True

    def test_invalid_evm_address_too_short(self):
        """Should reject short EVM address"""
        assert is_valid_evm_address("0x1234") is False

    def test_invalid_evm_address_no_prefix(self):
        """Should reject EVM address without 0x prefix"""
        assert is_valid_evm_address("1234567890123456789012345678901234567890") is False

    def test_invalid_evm_address_with_homoglyph(self):
        """Should reject EVM address with homoglyph"""
        address = "0x1234567890abcdef1234567890abcdef12345678".replace("a", "\u0430")  # Cyrillic а
        assert is_valid_evm_address(address) is False

    def test_valid_solana_address(self, valid_solana_address: str):
        """Should validate correct Solana address"""
        assert is_valid_solana_address(valid_solana_address) is True

    def test_invalid_solana_address(self):
        """Should reject invalid Solana address"""
        assert is_valid_solana_address("invalid") is False

    def test_valid_bitcoin_address_bech32(self, valid_bitcoin_address: str):
        """Should validate correct Bitcoin bech32 address"""
        assert is_valid_bitcoin_address(valid_bitcoin_address) is True

    def test_valid_bitcoin_address_legacy(self):
        """Should validate correct Bitcoin legacy address"""
        assert is_valid_bitcoin_address("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2") is True

    def test_is_valid_address_evm(self, valid_evm_address: str):
        """Should validate EVM address with chain hint"""
        assert is_valid_address(valid_evm_address, 1) is True

    def test_is_valid_address_solana(self, valid_solana_address: str):
        """Should validate Solana address with chain hint"""
        assert is_valid_address(valid_solana_address, "solana") is True

    def test_is_valid_address_bitcoin(self, valid_bitcoin_address: str):
        """Should validate Bitcoin address with chain hint"""
        assert is_valid_address(valid_bitcoin_address, "bitcoin") is True

    def test_validate_address_raises_on_homoglyph(self):
        """Should raise error for address with homoglyph"""
        address = "0x1234567890abcdef1234567890abcdef12345678".replace("a", "\u0430")  # Cyrillic а
        with pytest.raises(ProtocolBanksError) as exc_info:
            validate_address(address)
        assert exc_info.value.code == ErrorCodes.LINK_HOMOGLYPH_DETECTED

    def test_validate_address_raises_on_invalid(self):
        """Should raise error for invalid address"""
        with pytest.raises(ProtocolBanksError) as exc_info:
            validate_address("invalid")
        assert exc_info.value.code == ErrorCodes.LINK_INVALID_ADDRESS


class TestAmountValidation:
    """Tests for amount validation"""

    def test_valid_amount(self):
        """Should validate correct amount"""
        assert is_valid_amount("100") is True
        assert is_valid_amount("0.01") is True
        assert is_valid_amount("999999999") is True

    def test_invalid_amount_zero(self):
        """Should reject zero amount"""
        assert is_valid_amount("0") is False

    def test_invalid_amount_negative(self):
        """Should reject negative amount"""
        assert is_valid_amount("-100") is False

    def test_invalid_amount_too_large(self):
        """Should reject amount over 1 billion"""
        assert is_valid_amount("10000000000") is False

    def test_invalid_amount_not_number(self):
        """Should reject non-numeric amount"""
        assert is_valid_amount("abc") is False

    def test_validate_amount_raises_on_invalid(self):
        """Should raise error for invalid amount"""
        with pytest.raises(ProtocolBanksError) as exc_info:
            validate_amount("0")
        assert exc_info.value.code == ErrorCodes.LINK_INVALID_AMOUNT


class TestTokenValidation:
    """Tests for token validation"""

    def test_valid_tokens(self):
        """Should validate supported tokens"""
        assert is_valid_token("USDC") is True
        assert is_valid_token("usdc") is True
        assert is_valid_token("USDT") is True
        assert is_valid_token("ETH") is True

    def test_invalid_token(self):
        """Should reject unsupported token"""
        assert is_valid_token("INVALID") is False


class TestChainValidation:
    """Tests for chain validation"""

    def test_valid_chain_ids(self):
        """Should validate supported chain IDs"""
        assert is_valid_chain_id(1) is True
        assert is_valid_chain_id(137) is True
        assert is_valid_chain_id("solana") is True
        assert is_valid_chain_id("bitcoin") is True

    def test_invalid_chain_id(self):
        """Should reject unsupported chain ID"""
        assert is_valid_chain_id(999) is False
        assert is_valid_chain_id("invalid") is False


class TestExpiryValidation:
    """Tests for expiry validation"""

    def test_valid_expiry_hours(self):
        """Should validate correct expiry hours"""
        assert is_valid_expiry_hours(1) is True
        assert is_valid_expiry_hours(24) is True
        assert is_valid_expiry_hours(168) is True

    def test_invalid_expiry_hours(self):
        """Should reject invalid expiry hours"""
        assert is_valid_expiry_hours(0) is False
        assert is_valid_expiry_hours(169) is False
        assert is_valid_expiry_hours(-1) is False


class TestBatchValidation:
    """Tests for batch validation"""

    def test_valid_batch_size(self):
        """Should validate correct batch size"""
        assert is_valid_batch_size(1) is True
        assert is_valid_batch_size(500) is True

    def test_invalid_batch_size(self):
        """Should reject invalid batch size"""
        assert is_valid_batch_size(0) is False
        assert is_valid_batch_size(501) is False
