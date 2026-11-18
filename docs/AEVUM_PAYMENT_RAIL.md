# Aevum Payment Rail

A tUSD8 payment flow for merchants on QDay Aevum Testnet, shipped as a focused module in
Protocol Bank.

## Problem

Stablecoin invoices still break at the last mile: the payer has to copy an address, choose the
right network, use the right token and decimals, and the merchant has to verify a transaction
manually. On a new testnet, a wrong chain or a wrong token address is easy to miss.

## What this module does

1. Build an ERC-681 payment request pinned to Aevum Testnet (`chainId 44005`).
2. Let the payer scan a QR or open the request in MetaMask.
3. Send exactly the requested amount of tUSD8 with 6 decimals.
4. Verify the on-chain receipt server-side:
   - transaction succeeded,
   - log came from the official tUSD8 contract,
   - `Transfer` recipient matches,
   - amount matches the invoice exactly.
5. Link to the Aevum explorer receipt for independent verification.

## Network and token

| Field | Value |
| --- | --- |
| Network | QDay Aevum Testnet |
| Chain ID | `44005` (`0xABE5`) |
| RPC | `https://rpc-test.qday.info` |
| Explorer | `https://explorer-test.qday.info` |
| Gas token | tQDAY |
| Payment token | tUSD8 |
| tUSD8 contract | `0x456569838f1d43009A91ebA4263147Afd7233483` |
| tUSD8 decimals | `6` |

## Architecture

```
Browser (MetaMask)
  ├─ add/switch QDay Aevum (wallet_addEthereumChain / wallet_switchEthereumChain)
  ├─ ERC-681 request + QR
  └─ ERC-20 transfer(tUSD8, recipient, amount)
          │
          ▼
QDay Aevum Testnet
  └─ tUSD8 Transfer event
          │
          ▼
POST /api/aevum/verify
  ├─ eth_getTransactionReceipt
  ├─ check receipt.status === 0x1
  ├─ check log.address === tUSD8
  ├─ decode Transfer(from, to, value)
  └─ compare recipient + exact 6-decimal amount
```

The verifier is deliberately independent of wallet UI state. A wallet saying "success" is not
enough; the server checks the receipt and the token contract log.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/aevum-pay`.

Requirements: MetaMask, QDay Aevum Testnet added (the page can add it), and test tUSD8 from the
QDay faucet.

## Live deployment

- App: https://www.protocolbanks.com/aevum-pay
- Source: https://github.com/everest-an/protocol-banks---web3
- Network: QDay Aevum Testnet only

## Security notes

- Testnet only; no real funds and no token issuance.
- The module does not request token approvals; it sends a direct ERC-20 `transfer`.
- The verifier pins the tUSD8 contract address instead of trusting token symbols.
- Amounts are handled as integer base units from request creation through verification.
- No private key ever leaves MetaMask.

## Limitations

- Invoices are currently client-side references, not a server-side invoice database.
- No refund or dispute flow in this module.
- ERC-681 support depends on the payer wallet; the built-in MetaMask path is the tested one.
