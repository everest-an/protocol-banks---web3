"""
ProtocolBanks SDK - Chain and Token Configuration

多链配置，支持:
- Ethereum, Polygon, Base, Arbitrum, Optimism, BSC
- Solana, Bitcoin
"""

from __future__ import annotations

from typing import Any

from protocolbanks.types import ChainConfig, ChainId, TokenConfig, TokenSymbol


# ============================================================================
# Constants
# ============================================================================

PAYMENT_LINK_BASE_URL = "https://app.protocolbanks.com/pay"
DEFAULT_TOKEN: TokenSymbol = "USDC"
DEFAULT_EXPIRY_HOURS = 24
MAX_EXPIRY_HOURS = 168  # 7 days
MIN_AMOUNT = "0.01"
MAX_AMOUNT = "1000000000"  # 1 billion
MAX_BATCH_SIZE = 500

# ============================================================================
# USDC Contract Addresses
# ============================================================================

USDC_ADDRESSES: dict[int, str] = {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # Ethereum
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  # Polygon (native)
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Base
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  # Arbitrum
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",  # Optimism
    56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",  # BSC
}

# ============================================================================
# Chain Configurations
# ============================================================================

CHAIN_CONFIGS: dict[ChainId, ChainConfig] = {
    1: ChainConfig(
        id=1,
        name="Ethereum",
        native_currency="ETH",
        rpc_url="https://eth.llamarpc.com",
        explorer_url="https://etherscan.io",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[1],
                decimals=6,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0xdAC17F958D2ee523a2206206994597C13D831ec7",
                decimals=6,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="DAI",
                name="Dai Stablecoin",
                address="0x6B175474E89094C44Da98b954EescdeCB5BE3830",
                decimals=18,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="ETH",
                name="Ethereum",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    137: ChainConfig(
        id=137,
        name="Polygon",
        native_currency="MATIC",
        rpc_url="https://polygon.llamarpc.com",
        explorer_url="https://polygonscan.com",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[137],
                decimals=6,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
                decimals=6,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="DAI",
                name="Dai Stablecoin",
                address="0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
                decimals=18,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="MATIC",
                name="Polygon",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    8453: ChainConfig(
        id=8453,
        name="Base",
        native_currency="ETH",
        rpc_url="https://base.llamarpc.com",
        explorer_url="https://basescan.org",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[8453],
                decimals=6,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
                decimals=6,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="ETH",
                name="Ethereum",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    42161: ChainConfig(
        id=42161,
        name="Arbitrum",
        native_currency="ETH",
        rpc_url="https://arbitrum.llamarpc.com",
        explorer_url="https://arbiscan.io",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[42161],
                decimals=6,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                decimals=6,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="DAI",
                name="Dai Stablecoin",
                address="0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
                decimals=18,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="ETH",
                name="Ethereum",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    10: ChainConfig(
        id=10,
        name="Optimism",
        native_currency="ETH",
        rpc_url="https://optimism.llamarpc.com",
        explorer_url="https://optimistic.etherscan.io",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[10],
                decimals=6,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
                decimals=6,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="DAI",
                name="Dai Stablecoin",
                address="0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
                decimals=18,
                supports_gasless=True,
            ),
            TokenConfig(
                symbol="ETH",
                name="Ethereum",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    56: ChainConfig(
        id=56,
        name="BSC",
        native_currency="BNB",
        rpc_url="https://bsc.llamarpc.com",
        explorer_url="https://bscscan.com",
        tokens=[
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address=USDC_ADDRESSES[56],
                decimals=18,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="USDT",
                name="Tether USD",
                address="0x55d398326f99059fF775485246999027B3197955",
                decimals=18,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="DAI",
                name="Dai Stablecoin",
                address="0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
                decimals=18,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="BNB",
                name="BNB",
                address="native",
                decimals=18,
                supports_gasless=False,
            ),
        ],
    ),
    "solana": ChainConfig(
        id="solana",
        name="Solana",
        native_currency="SOL",
        rpc_url="https://api.mainnet-beta.solana.com",
        explorer_url="https://solscan.io",
        tokens=[
            TokenConfig(
                symbol="SOL",
                name="Solana",
                address="native",
                decimals=9,
                supports_gasless=False,
            ),
            TokenConfig(
                symbol="USDC",
                name="USD Coin",
                address="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                decimals=6,
                supports_gasless=False,
            ),
        ],
    ),
    "bitcoin": ChainConfig(
        id="bitcoin",
        name="Bitcoin",
        native_currency="BTC",
        rpc_url="",
        explorer_url="https://blockstream.info",
        tokens=[
            TokenConfig(
                symbol="BTC",
                name="Bitcoin",
                address="native",
                decimals=8,
                supports_gasless=False,
            ),
        ],
    ),
}

# ============================================================================
# Supported Tokens per Chain
# ============================================================================

SUPPORTED_TOKENS: dict[ChainId, list[TokenSymbol]] = {
    1: ["USDC", "USDT", "DAI", "ETH"],
    137: ["USDC", "USDT", "DAI", "MATIC"],
    8453: ["USDC", "USDT", "ETH"],
    42161: ["USDC", "USDT", "DAI", "ETH"],
    10: ["USDC", "USDT", "DAI", "ETH"],
    56: ["USDC", "USDT", "DAI", "BNB"],
    "solana": ["SOL", "USDC"],
    "bitcoin": ["BTC"],
}

# ============================================================================
# Helper Functions
# ============================================================================


def get_chain_config(chain_id: ChainId) -> ChainConfig | None:
    """Get chain configuration by ID"""
    return CHAIN_CONFIGS.get(chain_id)


def get_chain_tokens(chain_id: ChainId) -> list[TokenConfig]:
    """Get tokens for a chain"""
    config = CHAIN_CONFIGS.get(chain_id)
    return config.tokens if config else []


def get_token_config(chain_id: ChainId, token: TokenSymbol) -> TokenConfig | None:
    """Get token configuration for a chain"""
    tokens = get_chain_tokens(chain_id)
    for t in tokens:
        if t.symbol == token:
            return t
    return None


def get_chains_for_token(token: TokenSymbol) -> list[ChainId]:
    """Get chains that support a token"""
    chains: list[ChainId] = []
    for chain_id, tokens in SUPPORTED_TOKENS.items():
        if token in tokens:
            chains.append(chain_id)
    return chains


def get_token_decimals(chain_id: ChainId, token: TokenSymbol) -> int:
    """Get token decimals"""
    config = get_token_config(chain_id, token)
    return config.decimals if config else 18


def parse_amount(amount: str, decimals: int) -> str:
    """Parse amount to smallest unit"""
    try:
        value = float(amount)
        return str(int(value * (10**decimals)))
    except (ValueError, TypeError):
        return "0"


def format_amount(amount: str, decimals: int) -> str:
    """Format amount from smallest unit"""
    try:
        value = int(amount)
        return str(value / (10**decimals))
    except (ValueError, TypeError):
        return "0"


def is_chain_supported(chain_id: Any) -> bool:
    """Check if chain is supported"""
    return chain_id in CHAIN_CONFIGS


def is_token_supported(chain_id: ChainId, token: TokenSymbol) -> bool:
    """Check if token is supported on chain"""
    tokens = SUPPORTED_TOKENS.get(chain_id, [])
    return token in tokens
