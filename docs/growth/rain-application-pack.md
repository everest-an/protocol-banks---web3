# Rain Card Program — application pack

Practical materials for opening a card-program conversation with Rain
(rain.xyz), the questions to ask, and the technical readiness we already have.

> Reality check: Rain is **not self-serve**. Onboarding is partner-led: intro →
> sandbox → KYB / compliance review → program agreement (with their issuing-bank
> partner) → production. Sandbox access is the easy part; production timing
> depends on the entity, jurisdiction and use case.

---

## 1. Who we are (one-paragraph blurb to send)

Protocol Bank (protocolbanks.com) is an AI automated trading product with
non-custodial payment rails: users keep funds in their own wallets/accounts and
authorise payments by signature (EIP-3009) — the platform only submits and pays
gas. We want to add a **stablecoin-funded Visa card** so those users can spend
directly from their own balance.

- Entity / jurisdiction: `<to fill>`
- Use case: existing wallet users fund a card from their own USDC — this matches
  Rain's **per-user deposit contract** model, funds never touch a platform float
- Projected volume: `<to fill — e.g. 1k cards year one, $Xk monthly spend>`
- Compliance stance: KYC runs through Rain's own application API (we already
  call `POST /applications/user`); sanctions screening on our payment rails; no
  anonymous or unhosted cards

## 2. What is already built (lower integration risk for Rain)

| Piece | Where |
|---|---|
| Outbound Rain client — user application (KYC), per-user contracts (deposit address), card issue/list, **encrypted** secrets relay (browser-side decryption), balances | `lib/services/rain-card.service.ts` (+7 unit tests) |
| Webhook receiver with signature verification (`X-Rain-Signature`, `RAIN_WEBHOOK_SECRET`) | `services/webhook-handler/internal/handler/rain.go` |
| Funding path — user sends stablecoins to the per-user Rain deposit address; gas can be sponsored (EIP-3009 relayer already live) | `lib/services/relayer-submit.ts` |

A sandbox demo is quick: submit an application (`lastName: "approved"` skips KYC
in sandbox), create the contract, issue a virtual card, read balances.

## 3. Questions to ask Rain

- Program types: **consumer vs corporate** — which fits an existing B2C app?
- Jurisdictions you can onboard, and the KYB documents required (registration,
  UBO/ownership, directors, licenses)
- Deposit-contract chains supported, and settlement currency
- Fees: issuance, monthly, top-up, FX, and any **minimum volume commitment**
- KYC: does Rain run it end-to-end through `/applications/user`, and for which
  countries? Who owns AML/transaction monitoring?
- Sandbox: how keys are issued, limits, and the certification steps to
  production
- Card details: BIN/issuer, 3DS, physical cards, Apple/Google Pay
- Webhooks: full event catalogue, retry semantics, signature scheme

## 4. Realistic timeline

| Step | Typical |
|---|---|
| First response | days – 2 weeks |
| Sandbox access | days – weeks (after intro call / NDA) |
| Production | **weeks – months** — KYB + program agreement + bank partner; heavily jurisdiction- and volume-dependent |

## 5. Alternatives / fallbacks

- **Yativo** (already integrated): virtual Visa funded from a platform balance —
  fastest if they re-issue valid credentials (ours currently answer 401)
- **Crossmint** card API — wraps Rain under the hood and onboards developers more
  lightly; often the quickest route to a Rain-issued card
- Others worth comparing: Immersve / Baanx (crypto-card APIs), Reap, Wallester,
  Marqeta (enterprise)

## 6. Email template

> **Subject:** Card program inquiry — stablecoin-funded Visa cards for an existing wallet product
>
> Hello Rain team,
>
> We run Protocol Bank (protocolbanks.com), an AI trading product with
> non-custodial payment rails: users hold their own funds and authorise payments
> by signature. We want to add a stablecoin-funded Visa card, and your
> per-user deposit-contract model fits our flow exactly.
>
> We have already implemented your issuing API client (KYC application, per-user
> contracts, card issue/list, encrypted secrets relay) and a signature-verified
> webhook receiver — integration on our side is largely done. Could we get
> sandbox access to complete the flow, and a short call to discuss program
> requirements (jurisdictions, KYB, fees, minimums)?
>
> Happy to share the integration summary and a demo.
>
> Best,
> `<name>`, `<title>`, Protocol Bank
