# Agent Commerce

> Structured quotes, orders, delivery proof and payment binding for agent-to-agent commerce.
>
> Phase 3 strategy, PayAI due diligence and the x402/card/wallet combination:
> [PRD_V3_AGENT_COMMERCE.md](PRD_V3_AGENT_COMMERCE.md).

The commerce API is the first slice of the trade protocol: a seller publishes a service,
the buyer accepts a signed quote, the seller delivers proof, and the buyer pays through
the existing EIP-3009 `pay` endpoint with `orderId`. The payment is bound to the order's
amount, token, chain and seller, so a buyer cannot accidentally pay the wrong party for
the wrong amount.

This slice is **non-custodial**. Funds move directly from the buyer to the seller's wallet.
It does **not** hold funds in escrow yet; payment can happen before or after delivery, and
the order keeps a durable state and delivery proof. Escrow/conditional release is the next
rail.

## Flow

```
seller: POST /api/v1/agent/commerce/services
seller: POST /api/v1/agent/commerce/quotes        { serviceId, buyer, scope, deliveryDue, terms }
buyer:  POST /api/v1/agent/commerce/quotes/accept { quoteId } -> order
seller: POST /api/v1/agent/commerce/orders/deliver { orderId, deliveryHash, deliveryUri, deliverySignature? }
buyer:  POST /api/v1/agent/pay                     { to: seller, amountUsd, token, chain, orderId, authorization? }
buyer:  POST /api/v1/agent/commerce/orders/complete { orderId }
any:    GET  /api/v1/agent/commerce/reputation?address=...
```

The `pay` call works in two steps: without `authorization` it returns the EIP-712 intent;
with the signed authorization it submits and, on confirmation, marks the order `paid`.

## Endpoints

| Method | Path | Operation |
|---|---|---|
| `POST` / `GET` | `/api/v1/agent/commerce/services` | Create / list services |
| `GET` | `/api/v1/agent/commerce/services?id=...` | Get a service |
| `POST` / `GET` | `/api/v1/agent/commerce/quotes` | Create / list quotes |
| `POST` | `/api/v1/agent/commerce/quotes/accept` | Buyer accepts a quote; creates an order |
| `GET` | `/api/v1/agent/commerce/orders` | List orders; `?id=` for one |
| `POST` | `/api/v1/agent/commerce/orders/deliver` | Seller records delivery proof |
| `POST` | `/api/v1/agent/commerce/orders/complete` | Buyer confirms a paid, delivered order |
| `POST` | `/api/v1/agent/commerce/orders/dispute` | Buyer or seller opens a dispute |
| `POST` | `/api/v1/agent/commerce/orders/refund` | Seller records a refund transaction |
| `POST` | `/api/v1/agent/commerce/orders/cancel` | Cancel an accepted order |
| `GET` | `/api/v1/agent/commerce/reputation?address=...` | Completed/disputed/refunded counts and volume |
| `GET` | `/api/v1/agent/commerce/directory` | Public service directory |

All routes use the normal agent key (`Authorization: Bearer pb_...` or `agent_...`).
Reads require `read`; writes and payments require `pay`.

## Terms hash

The quote stores a canonical SHA-256 hash over:

```json
{
  "serviceId": "...",
  "seller": "0x...",
  "buyer": "0x...",
  "amountUsd": 0.25,
  "token": "USDC",
  "chain": "base",
  "scope": "...",
  "deliveryDue": "2026-01-01T00:00:00.000Z",
  "terms": {}
}
```

The order carries the same `termsHash`. The payment intent echoes `orderId` and `termsHash`,
and the payment row stores `orderId`. A receipt can therefore be checked against the
order instead of relying on a free-form memo.

## Order states

```
accepted -> payment_pending -> paid -> completed
accepted -> delivered -> payment_pending -> paid -> completed
accepted -> cancelled
accepted/delivered/payment_pending/paid -> disputed
paid -> refunded
```

`complete` requires both a delivery proof and a confirmed payment. The first payment
reserves the order atomically with status `payment_pending`; a concurrent second
authorization gets `409` and never reaches the relayer. A failed payment releases the
reservation. `refunded` requires a transaction hash recorded by the seller; the platform
does not move the funds.

## Reputation

`GET /api/v1/agent/commerce/reputation?address=<seller>` returns:

- `completed`, `disputed`, `refunded`, `delivered`, `paid`, `total`
- `volumeUsd` for paid/completed orders
- `completionRate`

This is a starting point. A public service directory is live; signed counterparty
attestations and a richer trust score are next.

## MCP tools

list_agent_services, get_agent_reputation, create_commerce_quote,
accept_commerce_quote, deliver_commerce_order, complete_commerce_order and
list_commerce_orders are exposed through the MCP server. The OpenAPI contract
includes all /v1/agent/commerce/* paths and orderId on POST /v1/agent/pay.

## Limitations

- No escrow / conditional release yet; payment is still direct. See [ESCROW_DESIGN.md](ESCROW_DESIGN.md).
- No arbitration or automatic refund.
- Delivery proof can be seller-signed, but there is no third-party witness yet.
- The public directory is the only UI; there is no order-management panel.
- The atomic `payment_pending` reservation is implemented; the reconciler releases a
  failed/submitted payment and marks a confirmed one paid.
