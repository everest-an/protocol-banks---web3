# ProtocolBanks Python SDK

Multi-chain cryptocurrency payment SDK for Python applications.

## Features

- 🔗 **Payment Links** - Generate signed payment links with QR codes
- ⛽ **Gasless Payments** - x402 protocol for gas-free USDC transfers
- 📦 **Batch Payments** - Process up to 500 payments in a single batch
- 🔔 **Webhooks** - Secure webhook signature verification
- 🔐 **Security** - HMAC signatures, homoglyph detection, constant-time comparison

## Supported Chains

- Ethereum (chainId: 1)
- Polygon (chainId: 137)
- Base (chainId: 8453)
- Arbitrum (chainId: 42161)
- Optimism (chainId: 10)
- BSC (chainId: 56)
- Solana
- Bitcoin

## Supported Tokens

USDC, USDT, DAI, ETH, MATIC, BNB, SOL, BTC

## Installation

```bash
pip install protocolbanks
```

## Quick Start

```python
from protocolbanks import ProtocolBanksClient

# Initialize client
client = ProtocolBanksClient(
    api_key="pk_live_xxx",
    api_secret="sk_live_xxx",
    environment="production"
)

# Generate payment link
link = client.links.generate(
    to="0x1234567890123456789012345678901234567890",
    amount="100",
    token="USDC",
    expiry_hours=24,
    memo="Invoice #12345"
)

print(f"Payment URL: {link.url}")

# Verify webhook
result = client.webhooks.verify(
    payload=request_body,
    signature=request_headers["X-PB-Signature"],
    secret="whsec_xxx"
)

if result.valid:
    event = result.event
    if event.type == "payment.completed":
        print(f"Payment completed: {event.data}")
```

## x402 Gasless Payments

```python
# Create authorization for gasless payment
auth = await client.x402.create_authorization(
    to="0x1234567890123456789012345678901234567890",
    amount="100",
    token="USDC",
    chain_id=137  # Polygon
)

# Get typed data for wallet signing
typed_data = client.x402.get_typed_data(auth, from_address="0x...")

# After user signs, submit to relayer
result = await client.x402.submit_signature(auth.id, signature)
```

## Batch Payments

```python
# Validate batch
recipients = [
    {"address": "0x1234...", "amount": "100", "token": "USDC"},
    {"address": "0x5678...", "amount": "50", "token": "USDC"},
]

errors = await client.batch.validate(recipients)
if not errors:
    result = await client.batch.submit(recipients)
    print(f"Batch ID: {result.batch_id}")
```

## Documentation

- [API Reference](https://docs.protocolbanks.com/sdk/python/api)
- [Integration Guide](https://docs.protocolbanks.com/sdk/python/guide)
- [Examples](https://github.com/protocolbanks/protocolbanks-python/tree/main/examples)

## License

MIT License - see [LICENSE](LICENSE) for details.
