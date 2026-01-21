"""
ProtocolBanks SDK - x402 Gasless Payment Module

EIP-712 签名授权，支持:
- TransferWithAuthorization (ERC-3009)
- Gasless 支付
- Nonce 管理
- 授权生命周期
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

from protocolbanks.config import USDC_ADDRESSES, get_token_config, parse_amount
from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import (
    ChainId,
    EIP712Domain,
    ErrorCodes,
    TokenSymbol,
    TransferWithAuthorizationMessage,
    X402Authorization,
    X402AuthorizationParams,
    X402Status,
)
from protocolbanks.utils.crypto import generate_nonce, generate_uuid
from protocolbanks.utils.validation import validate_address, validate_amount, validate_token


# ============================================================================
# Constants
# ============================================================================

DEFAULT_VALIDITY_SECONDS = 3600  # 1 hour
MAX_VALIDITY_SECONDS = 86400  # 24 hours

# Chains that support x402 gasless payments
X402_SUPPORTED_CHAINS: list[int] = [1, 137, 8453, 42161, 10]

# Tokens that support x402 (ERC-3009)
X402_SUPPORTED_TOKENS: list[TokenSymbol] = ["USDC", "DAI"]

# EIP-712 type definitions for TransferWithAuthorization
TRANSFER_WITH_AUTHORIZATION_TYPES: dict[str, list[dict[str, str]]] = {
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ],
}

# Token names for EIP-712 domain
TOKEN_NAMES: dict[TokenSymbol, str] = {
    "USDC": "USD Coin",
    "USDT": "Tether USD",
    "DAI": "Dai Stablecoin",
    "ETH": "Ethereum",
    "MATIC": "Polygon",
    "BNB": "BNB",
    "SOL": "Solana",
    "BTC": "Bitcoin",
}


class X402Module:
    """x402 Gasless Payment Module"""

    def __init__(self, http_client: Any):
        self._http = http_client
        self._authorizations: dict[str, X402Authorization] = {}

    # ============================================================================
    # Public Methods
    # ============================================================================

    async def create_authorization(
        self, params: X402AuthorizationParams | dict
    ) -> X402Authorization:
        """Create EIP-712 authorization for signing"""
        # Convert dict to params if needed
        if isinstance(params, dict):
            params = X402AuthorizationParams(**params)

        # Validate parameters
        self._validate_params(params)

        # Check chain support
        if not self.is_chain_supported(params.chain_id):
            raise ProtocolBanksError(
                code=ErrorCodes.X402_UNSUPPORTED_CHAIN,
                message=f"Chain {params.chain_id} does not support x402 gasless payments",
                details={
                    "chain_id": params.chain_id,
                    "supported_chains": X402_SUPPORTED_CHAINS,
                },
                retryable=False,
            )

        # Check token support
        if not self.is_token_supported(params.chain_id, params.token):
            raise ProtocolBanksError(
                code=ErrorCodes.X402_UNSUPPORTED_TOKEN,
                message=f"Token {params.token} does not support x402 on chain {params.chain_id}",
                details={"token": params.token, "chain_id": params.chain_id},
                retryable=False,
            )

        # Get token config
        token_config = get_token_config(params.chain_id, params.token)  # type: ignore
        if not token_config:
            raise ProtocolBanksError(
                code=ErrorCodes.X402_UNSUPPORTED_TOKEN,
                message=f"Token {params.token} not found on chain {params.chain_id}",
                retryable=False,
            )

        # Calculate timestamps
        import time

        now = int(time.time())
        valid_for = min(params.valid_for or DEFAULT_VALIDITY_SECONDS, MAX_VALIDITY_SECONDS)
        valid_after = now
        valid_before = now + valid_for

        # Generate unique nonce
        nonce = generate_nonce()

        # Get token contract address
        token_address = self._get_token_address(params.chain_id, params.token)

        # Build EIP-712 domain
        domain = EIP712Domain(
            name=TOKEN_NAMES.get(params.token, params.token),
            version="2",  # USDC uses version 2
            chain_id=params.chain_id,
            verifying_contract=token_address,
        )

        # Build message
        value = parse_amount(params.amount, token_config.decimals)
        message = TransferWithAuthorizationMessage(
            **{
                "from": "",  # Will be filled by signer
                "to": params.to,
                "value": value,
                "valid_after": valid_after,
                "valid_before": valid_before,
                "nonce": nonce,
            }
        )

        # Generate authorization ID
        auth_id = f"x402_{generate_uuid().replace('-', '')}"

        # Create authorization object
        authorization = X402Authorization(
            id=auth_id,
            domain=domain,
            types=TRANSFER_WITH_AUTHORIZATION_TYPES,
            message=message,
            status="pending",
            created_at=datetime.now(),
            expires_at=datetime.fromtimestamp(valid_before),
        )

        # Store locally
        self._authorizations[auth_id] = authorization

        # Register with backend (optional)
        try:
            await self._http.post(
                "/x402/authorizations",
                {
                    "id": auth_id,
                    "chain_id": params.chain_id,
                    "token": params.token,
                    "to": params.to,
                    "amount": params.amount,
                    "valid_before": valid_before,
                    "nonce": nonce,
                },
            )
        except Exception:
            # Continue even if backend registration fails
            pass

        return authorization

    async def submit_signature(
        self, auth_id: str, signature: str
    ) -> X402Authorization:
        """Submit signed authorization to relayer"""
        auth = self._authorizations.get(auth_id)

        if not auth:
            raise ProtocolBanksError(
                code=ErrorCodes.X402_AUTHORIZATION_EXPIRED,
                message="Authorization not found or expired",
                retryable=False,
            )

        # Check if expired
        if self._is_expired(auth):
            auth.status = "expired"
            raise ProtocolBanksError(
                code=ErrorCodes.X402_AUTHORIZATION_EXPIRED,
                message="Authorization has expired",
                retryable=False,
            )

        # Validate signature format
        if not self._is_valid_signature(signature):
            raise ProtocolBanksError(
                code=ErrorCodes.X402_INVALID_SIGNATURE,
                message="Invalid signature format",
                retryable=False,
            )

        # Update status
        auth.status = "signed"
        auth.signature = signature

        # Submit to relayer
        try:
            response = await self._http.post(
                "/x402/submit",
                {
                    "authorization_id": auth_id,
                    "signature": signature,
                    "domain": auth.domain.model_dump(),
                    "message": auth.message.model_dump(by_alias=True),
                },
            )

            auth.status = response.get("status", "submitted")
            auth.transaction_hash = response.get("transaction_hash")

        except Exception as e:
            auth.status = "failed"
            raise e

        return auth

    async def get_status(self, auth_id: str) -> X402Authorization:
        """Get authorization status"""
        # Check local cache first
        local_auth = self._authorizations.get(auth_id)

        if local_auth:
            # Check if expired
            if self._is_expired(local_auth) and local_auth.status == "pending":
                local_auth.status = "expired"

            # If not final status, fetch from backend
            if not self._is_final_status(local_auth.status):
                try:
                    response = await self._http.get(f"/x402/authorizations/{auth_id}")

                    # Update local cache
                    local_auth.status = response.get("status", local_auth.status)
                    if response.get("transaction_hash"):
                        local_auth.transaction_hash = response["transaction_hash"]

                except Exception:
                    # Return local state if backend unavailable
                    pass

            return local_auth

        # Fetch from backend
        response = await self._http.get(f"/x402/authorizations/{auth_id}")

        # Create authorization from response
        auth = X402Authorization(**response)

        # Cache locally
        self._authorizations[auth_id] = auth

        return auth

    async def cancel(self, auth_id: str) -> None:
        """Cancel pending authorization"""
        auth = self._authorizations.get(auth_id)

        if not auth:
            raise ProtocolBanksError(
                code=ErrorCodes.X402_AUTHORIZATION_EXPIRED,
                message="Authorization not found",
                retryable=False,
            )

        # Can only cancel pending authorizations
        if auth.status not in ("pending", "signed"):
            raise ProtocolBanksError(
                code=ErrorCodes.X402_AUTHORIZATION_EXPIRED,
                message=f"Cannot cancel authorization in {auth.status} status",
                retryable=False,
            )

        # Update status
        auth.status = "cancelled"

        # Notify backend
        try:
            await self._http.post(f"/x402/authorizations/{auth_id}/cancel", {})
        except Exception:
            # Continue even if backend notification fails
            pass

    def is_chain_supported(self, chain_id: int) -> bool:
        """Check if chain supports x402"""
        return chain_id in X402_SUPPORTED_CHAINS

    def is_token_supported(self, chain_id: int, token: TokenSymbol) -> bool:
        """Check if token supports x402 on chain"""
        if not self.is_chain_supported(chain_id):
            return False

        token_config = get_token_config(chain_id, token)  # type: ignore
        return token_config.supports_gasless if token_config else False

    def get_supported_chains(self) -> list[int]:
        """Get supported chains"""
        return X402_SUPPORTED_CHAINS.copy()

    def get_supported_tokens(self, chain_id: int) -> list[TokenSymbol]:
        """Get supported tokens for chain"""
        if not self.is_chain_supported(chain_id):
            return []

        return [t for t in X402_SUPPORTED_TOKENS if self.is_token_supported(chain_id, t)]

    def get_typed_data(
        self, auth: X402Authorization, from_address: str
    ) -> dict[str, Any]:
        """Get EIP-712 typed data for signing"""
        return {
            "domain": auth.domain.model_dump(),
            "types": auth.types,
            "primaryType": "TransferWithAuthorization",
            "message": {
                **auth.message.model_dump(by_alias=True),
                "from": from_address,
            },
        }

    def get_pending_authorizations(self) -> list[X402Authorization]:
        """Get all pending authorizations"""
        return [
            auth
            for auth in self._authorizations.values()
            if auth.status in ("pending", "signed")
        ]

    def cleanup_expired(self) -> int:
        """Clean up expired authorizations"""
        cleaned = 0

        for auth_id, auth in list(self._authorizations.items()):
            if self._is_expired(auth):
                if auth.status == "pending":
                    auth.status = "expired"
                del self._authorizations[auth_id]
                cleaned += 1

        return cleaned

    # ============================================================================
    # Private Methods
    # ============================================================================

    def _validate_params(self, params: X402AuthorizationParams) -> None:
        """Validate authorization parameters"""
        validate_address(params.to, params.chain_id)  # type: ignore
        validate_amount(params.amount)
        validate_token(params.token)

        if params.valid_for is not None:
            if params.valid_for < 60 or params.valid_for > MAX_VALIDITY_SECONDS:
                raise ProtocolBanksError(
                    code=ErrorCodes.VALID_OUT_OF_RANGE,
                    message=f"valid_for must be between 60 and {MAX_VALIDITY_SECONDS} seconds",
                    retryable=False,
                )

    def _get_token_address(self, chain_id: int, token: TokenSymbol) -> str:
        """Get token contract address"""
        if token == "USDC":
            return USDC_ADDRESSES.get(chain_id, "")

        token_config = get_token_config(chain_id, token)  # type: ignore
        return token_config.address if token_config else ""

    def _is_expired(self, auth: X402Authorization) -> bool:
        """Check if authorization is expired"""
        return datetime.now() > auth.expires_at

    def _is_final_status(self, status: X402Status) -> bool:
        """Check if status is final"""
        return status in ("executed", "failed", "expired", "cancelled")

    def _is_valid_signature(self, signature: str) -> bool:
        """Validate signature format"""
        import re

        # EIP-712 signature should be 65 bytes (130 hex chars + 0x prefix)
        return bool(re.match(r"^0x[a-fA-F0-9]{130}$", signature))


def create_x402_module(http_client: Any) -> X402Module:
    """Create a new X402Module instance"""
    return X402Module(http_client)
