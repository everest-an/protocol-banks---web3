# SubscriptionManager — deployment runbook

Every step below has been exercised end-to-end against a local chain. The only
part that cannot be automated here is signing: the deploying key must stay with
you.

## Before you start

**Do not deploy to mainnet until the contract has had a third-party audit.**
It has passed an adversarial code review, a Slither static analysis, and an
invariant fuzz suite (53 tests) — none of which substitute for a human audit of
a contract that pulls real USDC on a schedule.

Deploy to a testnet first and run a full billing cycle through it.

## 1. Configure

`contracts/.env` (not committed):

```
PRIVATE_KEY=<deployer key — never share this, not with anyone>
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=<for source verification>

# Strongly recommended: a multisig that will hold the pause key.
# Without it the deployer EOA keeps that power.
SUBSCRIPTION_MANAGER_OWNER=0x<multisig>
```

The owner's only power is pause/unpause. It cannot move, redirect, or increase
charges — user funds never enter the contract. But a compromised owner key can
halt every merchant's revenue, so it belongs in a multisig.

## 2. Deploy

```bash
cd contracts
npx hardhat run scripts/deploy-subscription-manager.ts --network arbitrumSepolia
```

Note the printed address.

## 3. Verify the source

```bash
npx hardhat verify --network arbitrumSepolia <MANAGER_ADDRESS> <OWNER_ADDRESS>
```

Payers are being asked to grant this contract an allowance. Unverified source
means they cannot check what they are approving.

## 4. Allowlist each token

Until a token is allowlisted, `createSubscription` reverts with
`TokenNotAllowed`.

```bash
MANAGER_ADDRESS=0x... TOKEN=0x<usdc> \
  npx hardhat run scripts/allowlist-token.ts --network arbitrumSepolia
```

The script checks the target is a real ERC-20 and reports whether it supports
EIP-2612 permit. Without permit, the one-transaction setup path
(`createSubscriptionWithPermit`) reverts and payers must `approve()` first.

**Only standard ERC-20s.** Fee-on-transfer and rebasing tokens deliver less than
`amountPerPeriod`; the contract cannot detect this, so the merchant is shorted
while events report the full amount.

Canonical USDC (all support permit):

| Chain | Chain ID | USDC |
|---|---|---|
| Arbitrum One | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Optimism | 10 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |

Verify each against the chain's own explorer before use — bridged variants
(`USDC.e`) are different contracts and may not support permit.

## 5. Confirm the deployment

```bash
MANAGER_ADDRESS=0x... TOKENS=0x<usdc> \
  npx hardhat run scripts/verify-deployment.ts --network arbitrumSepolia
```

Checks bytecode is present, reports the owner, pause state, and limits, and
flags an EOA owner or a missing token allowlist. A contract that is deployed but
not allowlisted fails at the first charge rather than at deploy time.

## 6. Record the address in the app

`lib/services/subscription-manager-contract.ts`:

```ts
export const SUBSCRIPTION_MANAGER_CONTRACTS: Record<number, Address> = {
  42161: '0x...', // Arbitrum
}
```

The app falls back to per-period ERC-3009 signatures on any chain without an
entry, so this is the switch that turns on the one-transaction flow. No other
code change is needed.

## 7. Hand ownership to the multisig

If `SUBSCRIPTION_MANAGER_OWNER` was not set at deploy time:

```solidity
manager.transferOwnership(<multisig>);   // from the deployer
// then, from the multisig:
manager.acceptOwnership();
```

`Ownable2Step` — the transfer is not effective until accepted, so a mistyped
address cannot orphan the pause key.

## 8. Run a real billing cycle on testnet

Before touching mainnet, with a test USDC:

1. Create a subscription through the UI (one transaction).
2. Confirm the mandate is linked: `POST /api/subscriptions/<id>/onchain` should
   already have run; check `onchain_subscription_id` is set.
3. Wait for the first charge, or fast-forward and trigger the cron.
4. Confirm the merchant received exactly `amountPerPeriod` and the payer's
   balance dropped by the same.
5. Cancel and confirm no further charge executes.
6. If a notice period is set, confirm `announceCharge` runs first and that
   cancelling during the window blocks the charge.

## Rollback

There is no upgrade path — the contract is not upgradeable, which is why the
owner cannot alter anyone's terms. To retire a deployment:

1. `pause()` — stops new charges and new subscriptions.
2. Remove the address from `SUBSCRIPTION_MANAGER_CONTRACTS` so the app stops
   creating mandates against it.
3. Existing payers keep control regardless: they can `cancel()` while paused, and
   revoking the ERC-20 allowance stops everything unilaterally.
