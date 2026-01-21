"""Pytest configuration and fixtures"""

import pytest


@pytest.fixture
def api_key() -> str:
    """Test API key"""
    return "pk_test_abcdefghijklmnopqrstuvwx"


@pytest.fixture
def api_secret() -> str:
    """Test API secret"""
    return "sk_test_abcdefghijklmnopqrstuvwxyz123456"


@pytest.fixture
def webhook_secret() -> str:
    """Test webhook secret"""
    return "whsec_test_secret_key_12345"


@pytest.fixture
def valid_evm_address() -> str:
    """Valid EVM address"""
    return "0x1234567890123456789012345678901234567890"


@pytest.fixture
def valid_solana_address() -> str:
    """Valid Solana address"""
    return "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy"


@pytest.fixture
def valid_bitcoin_address() -> str:
    """Valid Bitcoin address"""
    return "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
