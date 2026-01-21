"""Tests for Payment Link Module"""

import pytest

from protocolbanks.errors import ProtocolBanksError
from protocolbanks.modules.links import PaymentLinkModule
from protocolbanks.types import ErrorCodes, PaymentLinkParams


@pytest.fixture
def link_module(api_secret: str) -> PaymentLinkModule:
    """Create PaymentLinkModule instance"""
    return PaymentLinkModule(api_secret)


class TestPaymentLinkGeneration:
    """Tests for payment link generation"""

    def test_generate_basic_link(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should generate basic payment link"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
                token="USDC",
            )
        )

        assert link.url.startswith("https://")
        assert valid_evm_address in link.url
        assert "100" in link.url
        assert "USDC" in link.url
        assert link.signature
        assert link.payment_id.startswith("pay_")

    def test_generate_link_with_dict(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should generate link from dict params"""
        link = link_module.generate(
            {
                "to": valid_evm_address,
                "amount": "50",
                "token": "USDT",
            }
        )

        assert link.url
        assert link.params.amount == "50"
        assert link.params.token == "USDT"

    def test_generate_link_with_memo(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should include memo in link"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
                memo="Invoice #12345",
            )
        )

        assert "memo" in link.url
        assert link.params.memo == "Invoice #12345"

    def test_generate_link_default_token(
        self, link_module: PaymentLinkModule, valid_evm_address: str
    ):
        """Should default to USDC token"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
            )
        )

        assert link.params.token == "USDC"

    def test_generate_link_invalid_address(self, link_module: PaymentLinkModule):
        """Should reject invalid address"""
        with pytest.raises(ProtocolBanksError) as exc_info:
            link_module.generate(
                PaymentLinkParams(
                    to="invalid",
                    amount="100",
                )
            )
        assert exc_info.value.code == ErrorCodes.LINK_INVALID_ADDRESS

    def test_generate_link_invalid_amount(
        self, link_module: PaymentLinkModule, valid_evm_address: str
    ):
        """Should reject invalid amount"""
        with pytest.raises(ProtocolBanksError) as exc_info:
            link_module.generate(
                PaymentLinkParams(
                    to=valid_evm_address,
                    amount="0",
                )
            )
        assert exc_info.value.code == ErrorCodes.LINK_INVALID_AMOUNT

    def test_generate_link_homoglyph_address(self, link_module: PaymentLinkModule):
        """Should reject address with homoglyph"""
        address = "0x1234567890123456789012345678901234567890".replace("a", "а")
        with pytest.raises(ProtocolBanksError) as exc_info:
            link_module.generate(
                PaymentLinkParams(
                    to=address,
                    amount="100",
                )
            )
        assert exc_info.value.code == ErrorCodes.LINK_HOMOGLYPH_DETECTED


class TestPaymentLinkVerification:
    """Tests for payment link verification"""

    def test_verify_valid_link(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should verify valid link"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
            )
        )

        result = link_module.verify(link.url)
        assert result.valid is True
        assert result.expired is False
        assert len(result.tampered_fields) == 0

    def test_verify_tampered_link(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should detect tampered link"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
            )
        )

        # Tamper with amount
        tampered_url = link.url.replace("amount=100", "amount=200")
        result = link_module.verify(tampered_url)

        assert result.valid is False
        assert "signature" in result.tampered_fields

    def test_verify_invalid_url(self, link_module: PaymentLinkModule):
        """Should reject invalid URL"""
        result = link_module.verify("not-a-url")
        assert result.valid is False
        assert result.error is not None


class TestPaymentLinkParsing:
    """Tests for payment link parsing"""

    def test_parse_valid_link(self, link_module: PaymentLinkModule, valid_evm_address: str):
        """Should parse valid link"""
        link = link_module.generate(
            PaymentLinkParams(
                to=valid_evm_address,
                amount="100",
                token="USDC",
            )
        )

        params = link_module.parse(link.url)
        assert params is not None
        assert params.to == valid_evm_address
        assert params.amount == "100"
        assert params.token == "USDC"

    def test_parse_invalid_url(self, link_module: PaymentLinkModule):
        """Should return None for invalid URL"""
        params = link_module.parse("not-a-url")
        assert params is None


class TestChainTokenSupport:
    """Tests for chain/token support queries"""

    def test_get_supported_chains_usdc(self, link_module: PaymentLinkModule):
        """Should return chains supporting USDC"""
        chains = link_module.get_supported_chains("USDC")
        assert 1 in chains  # Ethereum
        assert 137 in chains  # Polygon

    def test_get_supported_tokens_ethereum(self, link_module: PaymentLinkModule):
        """Should return tokens supported on Ethereum"""
        tokens = link_module.get_supported_tokens(1)
        assert "USDC" in tokens
        assert "ETH" in tokens
