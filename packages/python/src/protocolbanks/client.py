"""
ProtocolBanks SDK - Main Client

SDK 主入口，集成所有模块
"""

from __future__ import annotations

from typing import Any

from protocolbanks.http import HttpClient
from protocolbanks.modules.batch import BatchModule
from protocolbanks.modules.links import PaymentLinkModule
from protocolbanks.modules.webhooks import WebhookModule
from protocolbanks.modules.x402 import X402Module
from protocolbanks.types import (
    ChainId,
    Environment,
    ProtocolBanksConfig,
    RetryConfig,
    TokenSymbol,
)


class ProtocolBanksClient:
    """
    ProtocolBanks SDK Client

    Main entry point for the SDK. Provides access to all modules:
    - links: Payment link generation and verification
    - x402: Gasless payment authorization
    - batch: Batch payment processing
    - webhooks: Webhook signature verification

    Example:
        ```python
        from protocolbanks import ProtocolBanksClient

        client = ProtocolBanksClient(
            api_key="pk_live_xxx",
            api_secret="sk_live_xxx",
            environment="production"
        )

        # Generate payment link
        link = client.links.generate(
            to="0x1234...",
            amount="100",
            token="USDC"
        )
        ```
    """

    def __init__(
        self,
        api_key: str | None = None,
        api_secret: str | None = None,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: float = 30.0,
        retry_config: RetryConfig | None = None,
        default_chain: ChainId | None = None,
        supported_chains: list[ChainId] | None = None,
        supported_tokens: list[TokenSymbol] | None = None,
        config: ProtocolBanksConfig | dict | None = None,
    ):
        """
        Initialize ProtocolBanks client.

        Args:
            api_key: API key (pk_live_xxx or pk_test_xxx)
            api_secret: API secret (sk_live_xxx or sk_test_xxx)
            environment: Environment (production, sandbox, testnet)
            base_url: Custom API base URL
            timeout: Request timeout in seconds
            retry_config: Retry configuration
            default_chain: Default chain for payments
            supported_chains: Allowed chains
            supported_tokens: Allowed tokens
            config: Full configuration object (alternative to individual params)
        """
        # Handle config object
        if config:
            if isinstance(config, dict):
                config = ProtocolBanksConfig(**config)
            api_key = config.api_key
            api_secret = config.api_secret
            environment = config.environment
            base_url = config.base_url
            timeout = config.timeout
            retry_config = config.retry_config
            default_chain = config.default_chain
            supported_chains = config.supported_chains
            supported_tokens = config.supported_tokens

        if not api_key or not api_secret:
            raise ValueError("api_key and api_secret are required")

        self._api_key = api_key
        self._api_secret = api_secret
        self._environment = environment
        self._default_chain = default_chain
        self._supported_chains = supported_chains
        self._supported_tokens = supported_tokens

        # Initialize HTTP client
        self._http = HttpClient(
            api_key=api_key,
            api_secret=api_secret,
            environment=environment,
            base_url=base_url,
            timeout=timeout,
            retry_config=retry_config,
        )

        # Initialize modules
        self._links = PaymentLinkModule(api_secret, base_url)
        self._x402 = X402Module(self._http)
        self._batch = BatchModule(self._http)
        self._webhooks = WebhookModule()

    @property
    def links(self) -> PaymentLinkModule:
        """Payment link module"""
        return self._links

    @property
    def x402(self) -> X402Module:
        """x402 gasless payment module"""
        return self._x402

    @property
    def batch(self) -> BatchModule:
        """Batch payment module"""
        return self._batch

    @property
    def webhooks(self) -> WebhookModule:
        """Webhook module"""
        return self._webhooks

    @property
    def environment(self) -> Environment:
        """Current environment"""
        return self._environment

    @property
    def default_chain(self) -> ChainId | None:
        """Default chain"""
        return self._default_chain

    @property
    def supported_chains(self) -> list[ChainId] | None:
        """Supported chains"""
        return self._supported_chains

    @property
    def supported_tokens(self) -> list[TokenSymbol] | None:
        """Supported tokens"""
        return self._supported_tokens

    async def close(self) -> None:
        """Close client and release resources"""
        await self._http.close()
        self._batch.stop_all_polling()

    async def __aenter__(self) -> "ProtocolBanksClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    def __repr__(self) -> str:
        return f"ProtocolBanksClient(environment={self._environment!r})"
