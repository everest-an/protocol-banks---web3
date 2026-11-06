# Escrow Design — Agent Commerce

> Status: design only. No escrow contract is deployed, and the current commerce
> flow is direct, non-custodial payment (buyer → seller), with an atomic order
> payment reservation. Do not describe the product as escrow until this design is
> implemented, tested, audited and legally reviewed.

## 1. Why escrow

Direct payment is enough when the buyer already trusts the seller or the amount
is small. It is not enough for:

- a new seller with no reputation;
- a milestone-based deliverable;
- a buyer that will not pay before delivery and a seller that will not deliver
  before payment;
- a dispute that needs a neutral release/refund decision.

Escrow moves the money to a neutral place, then releases it only on a defined
condition.

## 2. Custody model

Two options were considered:

| Option | Custody | Verdict |
|---|---|---|
| Platform escrow account | Platform controls the funds | Rejected: it changes the product into a custodial/money-transmission model and requires a license, safeguarding, reconciliation and capital rules |
| Smart-contract escrow | Funds sit in a non-upgradeable contract; the platform only relays signed messages | Preferred, subject to legal review and audit |

Even contract escrow can trigger money-transmission/escrow regulation depending
on jurisdiction and who controls release. Get a legal opinion before launch,
limit the first version to business buyers, and keep the platform out of the
funds path.

## 3. Roles

- **Buyer** — funds the order, signs release/refund decisions.
- **Seller** — delivers proof; can request release.
- **Resolver** — a multisig or independent arbitrator that resolves a disputed
  order. This is a deliberate trust point; publish the policy and the signer set.
- **Relayer** — submits transactions and pays gas; never holds funds.
- **Platform** — creates off-chain terms, stores `termsHash`, relays signed
  transactions, emits events and reconciles. It cannot move funds without a
  buyer signature or a resolver decision.

## 4. Contract interface (target)

```solidity
interface IAgentEscrow {
    function createOrder(
        bytes32 orderId,
        address buyer,
        address seller,
        address token,
        uint256 amount,
        uint64 deliveryDue,
        bytes32 termsHash
    ) external;

    function fundWithAuthorization(
        bytes32 orderId,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function release(bytes32 orderId, bytes calldata buyerSignature) external;
    function refund(bytes32 orderId, bytes calldata buyerSignature) external;
    function dispute(bytes32 orderId, bytes32 reasonHash) external;
    function resolve(bytes32 orderId, bool releaseToSeller, bytes32 resolutionHash) external;
    function cancel(bytes32 orderId, bytes calldata buyerSignature) external;
}
```

### Funding

`fundWithAuthorization` calls the token's EIP-3009
`transferWithAuthorization(from, address(this), value, ...)`. The buyer's own
signature authorizes the movement; the platform relayer only submits. The
contract checks:

- `msg.sender` is the relayer or is otherwise allowed;
- order exists, is not funded, not expired, not cancelled;
- `from == order.buyer`;
- `value == order.amount`;
- token supports EIP-3009;
- the USDC nonce has not been used (the token enforces this).

### Release

The buyer signs EIP-712:

```
Release(bytes32 orderId, bytes32 deliveryHash, uint256 nonce, uint256 deadline)
```

The contract verifies the buyer signature, checks the delivery hash registered
by the seller (or supplied with the release), then transfers the amount to the
seller. The buyer can also sign a refund to return the funds.

### Dispute

A dispute moves the order to `DISPUTED`. The resolver can call `resolve` with a
signed/public resolution hash. The resolution decision must be published and
auditable. A resolver key compromise is the main residual risk; use a multisig,
a timelock, and a published policy.

### Cancellation

Before funding, the buyer (or both parties) can cancel. After funding, only a
buyer-signed refund or a resolver decision can move funds.

## 5. State machine

```
CREATED
  -> FUNDED
  -> DELIVERED
  -> RELEASED
  -> REFUNDED

CREATED -> CANCELLED
FUNDED/DELIVERED -> DISPUTED -> RELEASED_OR_REFUNDED
```

`DELIVERED` is off-chain evidence (delivery hash/URI + optional seller signature)
that is also committed in the release or dispute message. It is not a guarantee
that the deliverable is correct; the dispute policy defines what counts.

## 6. Security requirements

- Reentrancy guard on every value-moving function.
- Checks-effects-interactions; never call an arbitrary token before state is
  final.
- EIP-712 domain includes chain id and verifying contract; nonces are
  per-order/per-buyer and cannot be replayed.
- Double-release, double-refund, wrong buyer, wrong seller and wrong amount
  revert.
- Expiry and cancellation paths tested.
- Resolver actions are role-gated, logged and pausable in an emergency.
- Contract is non-upgradeable for v1; migration is a new contract and explicit
  user action.
- USDC is the only supported token until the EIP-3009 surface is audited.
- The platform never stores buyer/seller private keys and never holds funds.

## 7. API mapping

Orders gain optional escrow fields:

```
escrow: {
  address: "0x...",
  onchainOrderId: "0x...",
  fundedTxHash: "0x...",
  releasedTxHash: "0x...",
  refundedTxHash: "0x...",
  state: "created|funded|delivered|released|refunded|disputed"
}
```

Target endpoints:

- `POST /api/v1/agent/commerce/orders/escrow/prepare`
- `POST /api/v1/agent/commerce/orders/escrow/fund` (buyer EIP-3009 signature)
- `POST /api/v1/agent/commerce/orders/release` (buyer EIP-712 signature)
- `POST /api/v1/agent/commerce/orders/refund` (buyer EIP-712 signature)
- `POST /api/v1/agent/commerce/orders/dispute`
- `POST /api/v1/agent/commerce/orders/resolve` (resolver only)

The off-chain order remains the source of terms and reputation; the contract is
the source of funds and release/refund truth. Reconcile both in the webhook
stream.

## 8. Legal and operational gates

- Legal opinion on escrow/money transmission in the operating jurisdiction and
  target markets.
- Terms of service, dispute policy, resolver agreement and prohibited categories.
- Sanctions/address screening at funding and release, where required.
- Incident response for resolver compromise, token failure, chain halt and
  contract bug.
- Independent audit plus a bug bounty before mainnet.
- Testnet/fork E2E: EIP-3009 funding, release, refund, expiry, double-spend,
  reentrancy, wrong signer, wrong amount, resolver rotation.

## 9. Recommendation

Ship the direct order flow with atomic payment reservation now. Build the escrow
contract as a separate, audited rail; do not mix it into the current payment
path or call the current flow escrow. The first escrow pilot should be a small
set of business buyers/sellers with a published resolver and a hard cap.
