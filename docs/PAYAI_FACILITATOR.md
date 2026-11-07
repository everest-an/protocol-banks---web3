# PayAI Facilitator Adapter

> Status: adapter implemented and unit-tested. The public free lane is used for
> ordinary exact payments; no PayAI API key is required until the 1,000 free
> credits are exhausted. This is a settlement rail, not the commerce brain.

## Endpoint

- Base URL: `https://facilitator.payai.network`
- `GET /supported` — public network/scheme list
- `GET /pricing` — public pricing
- `POST /verify` — verify an x402 payload
- `POST /settle` — settle an x402 payment

## Configuration

| Variable | Required | Notes |
|---|---|---|
| `PAYAI_FACILITATOR_URL` | no | Defaults to `https://facilitator.payai.network`. |
| `PAYAI_API_KEY_ID` | no | Only needed after free credits, or for an assigned lane. |
| `PAYAI_API_KEY_SECRET` | no | Ed25519 PKCS#8/DER, base64; `payai_sk_` prefix is stripped. |

Without keys the adapter uses the public lane and does **not** send an
Authorization header. With keys it creates a short-lived Ed25519 JWT and sends
`Authorization: Bearer <jwt>` on `/verify` and `/settle`.

## Code

`lib/payments/payai-facilitator.ts`:

- `getPayAISupported()`
- `getPayAIPricing()`
- `verifyPayAIPayment(paymentPayload, paymentRequirements)`
- `settlePayAIPayment(paymentPayload, paymentRequirements)`
- `buildPayAIJwt(keyId, keySecret, options)`

The adapter uses fetch only, so it works in Node/edge runtimes. The JWT is cached
for the token window.

## Why it is a rail

PayAI verifies and settles the x402 payment. It does not provide:

- agent mandate / per-key policy;
- budgets and card controls;
- quotes, orders, delivery proof, dispute or reputation;
- reconciliation into the owner's ledger.

Those stay in Protocol Bank. The adapter is intentionally replaceable with
Coinbase CDP, Cloudflare or the local relayer.

## Next integration step

1. Select PayAI for an x402 request in the existing `/api/x402/*` flow.
2. Map the x402 `paymentRequirements` to the order/quote terms.
3. Record the facilitator verification/settlement response on the order.
4. Keep the local relayer as a fallback.
