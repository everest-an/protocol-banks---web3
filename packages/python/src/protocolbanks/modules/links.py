"""
ProtocolBanks SDK - Payment Link Module

支付链接生成、验证、解析
支持多链、多币种
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from urllib.parse import parse_qs, urlencode, urlparse

from protocolbanks.config import (
    DEFAULT_EXPIRY_HOURS,
    DEFAULT_TOKEN,
    PAYMENT_LINK_BASE_URL,
    get_chain_tokens,
    get_chains_for_token,
)
from protocolbanks.errors import ProtocolBanksError
from protocolbanks.types import (
    ChainId,
    ErrorCodes,
    LinkVerificationResult,
    PaymentLink,
    PaymentLinkParams,
    QRCode,
    QROptions,
    TokenSymbol,
)
from protocolbanks.utils.crypto import generate_uuid
from protocolbanks.utils.validation import (
    detect_homoglyphs,
    is_expired,
    is_valid_address,
    validate_address,
    validate_amount,
    validate_chain_id,
    validate_expiry_hours,
    validate_memo,
    validate_token,
)

if TYPE_CHECKING:
    pass


class PaymentLinkModule:
    """Payment Link Module - Generate, verify, and parse payment links"""

    def __init__(self, api_secret: str, base_url: str | None = None):
        self._api_secret = api_secret
        self._base_url = base_url or PAYMENT_LINK_BASE_URL

    # ============================================================================
    # Generate Payment Link
    # ============================================================================

    def generate(self, params: PaymentLinkParams | dict) -> PaymentLink:
        """Generate a signed payment link"""
        # Convert dict to PaymentLinkParams if needed
        if isinstance(params, dict):
            params = PaymentLinkParams(**params)

        # Validate required parameters
        self._validate_params(params)

        # Set defaults
        token = params.token or DEFAULT_TOKEN
        expiry_hours = params.expiry_hours or DEFAULT_EXPIRY_HOURS

        # Calculate expiry timestamp
        now = datetime.now()
        now_ms = int(now.timestamp() * 1000)
        expiry_ms = now_ms + expiry_hours * 60 * 60 * 1000
        expires_at = datetime.fromtimestamp(expiry_ms / 1000)

        # Generate payment ID
        payment_id = f"pay_{generate_uuid().replace('-', '')}"

        # Generate signature
        signature = self._generate_signature(
            to=params.to,
            amount=params.amount,
            token=token,
            expiry=expiry_ms,
            memo=params.memo,
        )

        # Build URL
        url = self._build_url(params, token, expiry_ms, signature, payment_id)

        # Build short URL (placeholder)
        short_url = f"{self._base_url.replace('/pay', '')}/p/{payment_id[4:12]}"

        return PaymentLink(
            url=url,
            short_url=short_url,
            params=PaymentLinkParams(
                to=params.to,
                amount=params.amount,
                token=token,
                chain=params.chain,
                expiry_hours=expiry_hours,
                memo=params.memo,
                order_id=params.order_id,
                callback_url=params.callback_url,
                webhook_url=params.webhook_url,
                allowed_chains=params.allowed_chains,
                allowed_tokens=params.allowed_tokens,
                metadata=params.metadata,
            ),
            signature=signature,
            expires_at=expires_at,
            created_at=now,
            payment_id=payment_id,
        )

    # ============================================================================
    # Verify Payment Link
    # ============================================================================

    def verify(self, url: str) -> LinkVerificationResult:
        """Verify payment link integrity and expiry"""
        try:
            # Parse URL
            parsed = self._parse_url(url)
            if not parsed:
                return LinkVerificationResult(
                    valid=False,
                    expired=False,
                    tampered_fields=[],
                    error="Invalid payment link URL format",
                )

            params, signature, expiry = parsed

            # Check for homoglyphs
            homoglyph_details = detect_homoglyphs(params.to)
            if homoglyph_details:
                return LinkVerificationResult(
                    valid=False,
                    expired=False,
                    tampered_fields=["to"],
                    params=params,
                    error="Homoglyph attack detected in address",
                    homoglyph_detected=True,
                    homoglyph_details=homoglyph_details,
                )

            # Check expiry
            expired = is_expired(expiry)

            # Verify signature
            expected_signature = self._generate_signature(
                to=params.to,
                amount=params.amount,
                token=params.token or DEFAULT_TOKEN,
                expiry=expiry,
                memo=params.memo,
            )
            signature_valid = signature == expected_signature

            # Detect tampered fields
            tampered_fields: list[str] = []
            if not signature_valid:
                tampered_fields.append("signature")

            return LinkVerificationResult(
                valid=signature_valid and not expired,
                expired=expired,
                tampered_fields=tampered_fields,
                params=params,
                error=(
                    "Payment link has expired"
                    if expired
                    else "Payment link signature is invalid" if not signature_valid else None
                ),
            )

        except Exception as e:
            return LinkVerificationResult(
                valid=False,
                expired=False,
                tampered_fields=[],
                error=str(e),
            )

    # ============================================================================
    # Parse Payment Link
    # ============================================================================

    def parse(self, url: str) -> PaymentLinkParams | None:
        """Parse payment link URL to extract parameters"""
        parsed = self._parse_url(url)
        return parsed[0] if parsed else None

    # ============================================================================
    # QR Code Generation
    # ============================================================================

    async def generate_qr(
        self, link: PaymentLink, options: QROptions | None = None
    ) -> QRCode:
        """Generate QR code for payment link"""
        opts = options or QROptions()
        size = opts.size

        # Validate size
        if size < 100 or size > 1000:
            raise ProtocolBanksError(
                code=ErrorCodes.VALID_OUT_OF_RANGE,
                message="QR code size must be between 100 and 1000 pixels",
                retryable=False,
            )

        # Generate QR code data (placeholder - would use qrcode library)
        qr_data = self._generate_qr_data(link.url, opts)

        return QRCode(
            data=qr_data,
            format=opts.format,
            size=size,
            payment_link=link.url,
        )

    # ============================================================================
    # Chain/Token Support
    # ============================================================================

    def get_supported_chains(self, token: TokenSymbol) -> list[ChainId]:
        """Get supported chains for a token"""
        return get_chains_for_token(token)

    def get_supported_tokens(self, chain: ChainId) -> list[TokenSymbol]:
        """Get supported tokens for a chain"""
        return [t.symbol for t in get_chain_tokens(chain)]

    # ============================================================================
    # Private Methods
    # ============================================================================

    def _validate_params(self, params: PaymentLinkParams) -> None:
        """Validate payment link parameters"""
        # Validate recipient address
        validate_address(params.to, params.chain)

        # Validate amount
        validate_amount(params.amount)

        # Validate token if provided
        if params.token:
            validate_token(params.token)

        # Validate chain if provided
        if params.chain:
            validate_chain_id(params.chain)

        # Validate expiry hours if provided
        if params.expiry_hours is not None:
            validate_expiry_hours(params.expiry_hours)

        # Validate memo if provided
        if params.memo:
            validate_memo(params.memo)

        # Validate allowed chains
        if params.allowed_chains:
            for chain in params.allowed_chains:
                validate_chain_id(chain)

        # Validate allowed tokens
        if params.allowed_tokens:
            for token in params.allowed_tokens:
                validate_token(token)

    def _build_url(
        self,
        params: PaymentLinkParams,
        token: str,
        expiry: int,
        signature: str,
        payment_id: str,
    ) -> str:
        """Build payment link URL"""
        query_params: dict[str, str] = {
            "to": params.to,
            "amount": params.amount,
            "token": token,
            "exp": str(expiry),
            "sig": signature,
            "id": payment_id,
        }

        # Optional params
        if params.chain:
            query_params["chain"] = str(params.chain)
        if params.memo:
            query_params["memo"] = params.memo
        if params.order_id:
            query_params["orderId"] = params.order_id
        if params.callback_url:
            query_params["callback"] = params.callback_url
        if params.allowed_chains:
            query_params["chains"] = ",".join(str(c) for c in params.allowed_chains)
        if params.allowed_tokens:
            query_params["tokens"] = ",".join(params.allowed_tokens)

        return f"{self._base_url}?{urlencode(query_params)}"

    def _parse_url(
        self, url: str
    ) -> tuple[PaymentLinkParams, str, int] | None:
        """Parse payment link URL"""
        try:
            parsed = urlparse(url)
            query = parse_qs(parsed.query)

            # Extract required params
            to = query.get("to", [None])[0]
            amount = query.get("amount", [None])[0]
            signature = query.get("sig", [None])[0]
            expiry_str = query.get("exp", [None])[0]

            if not to or not amount or not signature or not expiry_str:
                return None

            expiry = int(expiry_str)

            # Extract optional params
            token = query.get("token", [DEFAULT_TOKEN])[0]
            chain_str = query.get("chain", [None])[0]
            memo = query.get("memo", [None])[0]
            order_id = query.get("orderId", [None])[0]
            callback_url = query.get("callback", [None])[0]
            chains_str = query.get("chains", [None])[0]
            tokens_str = query.get("tokens", [None])[0]

            # Parse chain
            chain: ChainId | None = None
            if chain_str:
                try:
                    chain = int(chain_str)  # type: ignore
                except ValueError:
                    chain = chain_str  # type: ignore

            # Parse allowed chains
            allowed_chains: list[ChainId] | None = None
            if chains_str:
                allowed_chains = []
                for c in chains_str.split(","):
                    try:
                        allowed_chains.append(int(c))  # type: ignore
                    except ValueError:
                        allowed_chains.append(c)  # type: ignore

            # Parse allowed tokens
            allowed_tokens: list[TokenSymbol] | None = None
            if tokens_str:
                allowed_tokens = tokens_str.split(",")  # type: ignore

            # Calculate expiry hours from timestamp
            now_ms = int(datetime.now().timestamp() * 1000)
            expiry_hours = max(1, (expiry - now_ms) // (60 * 60 * 1000))

            params = PaymentLinkParams(
                to=to,
                amount=amount,
                token=token,  # type: ignore
                chain=chain,
                expiry_hours=expiry_hours,
                memo=memo,
                order_id=order_id,
                callback_url=callback_url,
                allowed_chains=allowed_chains,
                allowed_tokens=allowed_tokens,
            )

            return (params, signature, expiry)

        except Exception:
            return None

    def _generate_signature(
        self,
        to: str,
        amount: str,
        token: str,
        expiry: int,
        memo: str | None = None,
    ) -> str:
        """Generate payment link signature"""
        # Normalize parameters
        normalized = {
            "amount": amount,
            "expiry": str(expiry),
            "memo": memo or "",
            "to": to.lower(),
            "token": token.upper(),
        }

        # Create canonical string (sorted keys)
        data_to_sign = "&".join(f"{k}={v}" for k, v in sorted(normalized.items()))

        # Simple hash for synchronous operation
        return self._simple_hash(data_to_sign + self._api_secret)[:16]

    def _simple_hash(self, s: str) -> str:
        """Simple hash for synchronous operation"""
        import hashlib

        return hashlib.sha256(s.encode()).hexdigest()

    def _generate_qr_data(self, content: str, options: QROptions) -> str:
        """Generate QR code data (placeholder)"""
        if options.format == "svg":
            return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{options.size}" height="{options.size}" viewBox="0 0 {options.size} {options.size}">
  <rect width="100%" height="100%" fill="{options.background}"/>
  <text x="50%" y="50%" text-anchor="middle" fill="{options.foreground}" font-size="12">
    QR: {content[:20]}...
  </text>
</svg>"""

        # Return base64 placeholder
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def create_payment_link_module(
    api_secret: str, base_url: str | None = None
) -> PaymentLinkModule:
    """Create a new PaymentLinkModule instance"""
    return PaymentLinkModule(api_secret, base_url)
