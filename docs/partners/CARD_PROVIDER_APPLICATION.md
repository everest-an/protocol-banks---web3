# Card Provider Application Pack — Yativo / Rain

> Purpose: prepare the application for a card-issuing partner so Protocol Bank
> can issue agent-scoped virtual Visa cards. The company must submit and sign the
> application; this document is the material checklist and the English drafts.
>
> Last updated: November 2026.

---

## 0. Pre-filled for Everest Holdings Group Co., Limited (Hong Kong)

Use this block for both forms. Fields marked `[REQUIRED]` must come from the
company — I cannot invent registration numbers, director IDs, addresses, phone
numbers or signatures.

| Field | Value |
|---|---|
| Legal entity | **Everest Holdings Group Co., Limited** |
| Jurisdiction | **Hong Kong** |
| Company registration no. | Provided in the signed KYB submission |
| Registered address | Provided in the signed KYB submission |
| Website | https://protocolbanks.com |
| Business | Execution and policy layer for AI agents |
| Product requested | **Card Issuing** (Yativo) / **Issuing API** (Rain) |
| Use case | Agent-scoped virtual Visa cards; one card per AI agent |
| Funding | USDC from the platform treasury |
| Custody | Provider holds the card balance; the platform does not custody user crypto |
| Expected volume | 50–200 active agents in the first 3 months; $10k–$50k monthly card load |
| Average ticket | $50–$200 |
| Target markets | Hong Kong / SEA / global - confirm |
| Contact name / title | `[REQUIRED]` |
| Contact email / phone | Provided in the signed KYB submission |
| Directors / UBOs | Provided in the signed KYB submission |
| Bank account | Provided in the signed KYB submission |
| Attachments | Certificate of incorporation, BR, directors/UBO IDs, proof of address, bank statement, AML/KYC policy, security overview |

### Copy-paste “What are you trying to do?” (Yativo)

> Everest Holdings Group Co., Limited is a Hong Kong company building Protocol Bank, an
> execution and policy layer for AI agents. Each agent gets a scoped credential
> and a budget; we want to issue one virtual Visa card per agent so it can pay
> for APIs, cloud and SaaS within that budget. We need card issuance, top-up,
> freeze/close and webhooks. Expected volume: 50–200 cards in the first 3
> months, $10k–$50k monthly load, average ticket $50–$200. The card balance is
> held by Yativo; we do not ask you to custody user crypto. Could we schedule a
> call to review KYB requirements, supported jurisdictions and the sandbox?

### Copy-paste message (Rain)

> Everest Holdings Group Co., Limited is a Hong Kong company building Protocol Bank, an
> execution and policy layer for AI agents. We are applying for Rain issuing API
> access: one virtual card per agent, funded from a platform treasury, with
> per-agent limits and freeze/close controls. Your “scoped cards” and
> “controlled agentic payments” use cases are an exact fit. Expected volume:
> 50–200 cards in the first 3 months, $10k–$50k monthly load. Could you share
> the partner/KYB process, sandbox access, supported countries and chains, fees,
> and the browser-side decryption flow for PAN/CVC?

### What I still need from you

1. Certificate of incorporation (the BR certificate is already on file)
2. Proof of registered address (the BR certificate shows the address)
3. Director/UBO details (name, DOB, nationality, ID/passport)
4. Contact person: name, title, company email, phone
5. Bank account details for the corporate account
6. Confirmation of target markets and expected volume (or approve the defaults above)
7. The KYB attachments listed in section 2

Once those are filled, the form is ready to submit. I cannot click submit or
send the email on your behalf.

---

## 1. What we are applying for

| Provider | Product | Why |
|---|---|---|
| **Yativo** | Crypto-funded virtual Visa cards (crypto.yativo.com) | Fastest path: USDC deposit → USD balance → virtual card; the client is already implemented (`lib/services/yativo-client.service.ts`) |
| **Rain** | Card issuing API (Rain developer sandbox → production) | Better long-term fit: per-user KYC, per-user deposit contracts, encrypted PAN/CVC, card webhooks (`lib/services/rain-card.service.ts`) |

We are **not** asking the provider to custody user crypto. The card balance is
provider-custodied; the platform controls issuance and per-agent limits.

---

## 2. Entity / KYB checklist

Prepare these before opening either application.

### Company
- [ ] Legal name, trading name, registration number, jurisdiction, incorporation date
- [ ] Certificate of incorporation
- [ ] Articles / operating agreement
- [ ] Registered address and proof of address (utility bill / bank statement, < 3 months)
- [ ] Website and app URLs (production and staging)
- [ ] Business description (see §3)
- [ ] Expected monthly card volume and average ticket
- [ ] Source of funds / source of crypto (exchange, treasury, user deposits)
- [ ] Licenses (money transmission, VASP, MSB) or a clear statement that the
      provider is the issuer and the platform is a programme manager

### Directors / UBOs
- [ ] Full legal name, date of birth, nationality, residential address
- [ ] Passport / national ID
- [ ] Proof of address (< 3 months)
- [ ] Ownership percentage
- [ ] LinkedIn / professional profile (optional but speeds review)

### Banking / treasury
- [ ] Corporate bank account (name, IBAN/SWIFT, bank statement)
- [ ] Crypto treasury addresses and custody model
- [ ] Refund / chargeback contact and process

### Compliance
- [ ] AML/KYC policy (or the provider's flow, if they run KYC)
- [ ] Sanctions screening and transaction monitoring process
- [ ] Restricted jurisdictions and prohibited merchant categories
- [ ] Data protection: GDPR/CCPA posture, retention, sub-processors
- [ ] Security: key management, encryption at rest, access control, incident response
- [ ] Complaint / dispute handling and customer support SLAs

### Technical
- [ ] Sandbox and production API base URLs
- [ ] Webhook endpoint and signing secret
- [ ] Callback allowlist (IPs/domains)
- [ ] KYC redirect URL (if hosted)
- [ ] Support contact for integration

---

## 3. Business description (copy/paste answer)

> Protocol Bank is an execution and policy layer for AI agents. Businesses and
> developers give an AI agent one credential; our server enforces which
> operations it may perform (read, trade, pay, swap), a per-call cap, a daily cap
> and a coin allowlist. Trading runs through a trading-only Hyperliquid agent
> wallet; payments use EIP-3009 payer signatures. We are adding **agent-scoped
> virtual Visa cards** so an agent can pay for APIs, cloud, SaaS and other online
> services within a budget the owner sets. Each card belongs to exactly one agent,
> and issuing/funding consumes that agent's budget. We do not provide investment
> advice and do not custody user crypto; the card balance is held by the issuing
> partner.

**Use case:** AI agents paying for online services (API credits, cloud, SaaS,
ads, data) under a hard monthly limit; human owners can freeze or close the card
at any time.

**Expected volume (adjust before submitting):**
- First 3 months: 50–200 active agents, $10k–$50k monthly card load
- Average ticket: $50–$200
- Markets: [list target countries]
- Prohibited: gambling, adult content, cash-like instruments, sanctioned
  jurisdictions

---

## 3b. Official application links (verified)

| Provider | Use this page | Notes |
|---|---|---|
| **Yativo** | https://yativo.com/contact/ | Contact form; select **Card Issuing** in the product list. The page says 1–2 business days. |
| Yativo (product) | https://yativo.com/card-issuing/ | Stablecoin-backed cards for business; useful context for the form. |
| Yativo (sandbox) | https://test.yativo.com | Sandbox signup; card features are mock in sandbox. |
| **Rain** | https://www.rain.xyz/contact-us | “Book a demo” / contact form. |
| Rain (scoped cards) | https://www.rain.xyz/solutions/scoped-cards | Closest fit for agent-scoped cards. |
| Rain (agentic) | https://www.rain.xyz/solutions/controlled-agentic-payments | Agent guardrails; use this language in the form. |
| Rain (API docs) | https://docs.rain.xyz/ | API docs / portal after contact. |

No public application email address is listed on either page; use the forms and
ask for an intro call. If you want an email instead, submit the form first and
reply to the thread they open.

### Yativo form — field-by-field paste

| Field | Value |
|---|---|
| First name / Last name | [your name] |
| Email | [your work email] |
| Phone | [your phone] |
| Company name | [legal entity] |
| Company website | https://protocolbanks.com |
| Product | **Card Issuing** |
| What are you trying to do with Yativo? | See the paragraph below |

> We are building an execution and policy layer for AI agents. Each agent gets a
> scoped credential and a budget; we want to issue one virtual Visa card per
> agent so it can pay for APIs, cloud and SaaS within that budget. We need
> card issuance, top-up, freeze/close and webhooks. Expected volume: 50–200
> cards in the first 3 months, $10k–$50k monthly load, average ticket $50–$200.
> The card balance is held by Yativo; we do not ask you to custody user crypto.
> Could we schedule a call to review KYB requirements, supported jurisdictions
> and the sandbox?

### Rain form — field-by-field paste

| Field | Value |
|---|---|
| Name | [your name] |
| Work email | [your work email] |
| Company | [legal entity] |
| Website | https://protocolbanks.com |
| Use case | Scoped virtual cards for AI agents / controlled agentic payments |
| Message | See the paragraph below |

> We are applying for Rain issuing API access for Protocol Bank, an execution
> and policy layer for AI agents. We want to issue one virtual card per agent,
> funded from a platform treasury, with per-agent limits and freeze/close
> controls. Your “scoped cards” and “controlled agentic payments” use cases are
> an exact fit. Expected volume: 50–200 cards in the first 3 months, $10k–$50k
> monthly load. Could you share the partner/KYB process, sandbox access,
> supported countries and chains, fees, and the browser-side decryption flow for
> PAN/CVC?

## 4. Yativo application draft (email / form)

**Subject:** Virtual card programme application — Protocol Bank (AI agent cards)

> Hello Yativo team,
>
> We are applying for a virtual Visa card programme for Protocol Bank, an
> execution and policy layer for AI agents. Our users give an AI agent a scoped
> credential and a budget; we want to issue one virtual card per agent so the
> agent can pay for APIs, cloud and SaaS within that budget.
>
> Company: [legal name], [registration number], [jurisdiction]
> Website: [https://…]
> Contact: [name], [role], [email], [phone]
> Expected volume: [50–200 cards in the first 3 months; $10k–$50k monthly load]
> Average ticket: [$50–$200]
> Funding: USDC from the platform treasury (we already have the deposit-address
> integration). Card balance is held by Yativo.
>
> Attached: certificate of incorporation, directors/UBO IDs, proof of address,
> bank statement, AML/KYC policy, security overview.
>
> Could you confirm the onboarding steps, required KYB documents, supported
> jurisdictions, card BIN/programme, fees, and whether your API supports
> per-card limits, freezing and webhooks for authorisation/decline events?
>
> Best regards,
> [name]

**Questions to ask Yativo:**
1. Which entity/KYB documents are required, and in which format?
2. Which jurisdictions and merchant categories are supported?
3. Is there a per-card spending limit and a freeze endpoint?
4. Are card details (PAN/CVV) available through an API, or only in the dashboard?
5. What are the issuance, load, FX and decline fees?
6. Do you support a sandbox with mock cards? (Their docs say card features are mock in sandbox.)
7. What webhooks exist for authorisation, settlement and chargeback?

---

## 5. Rain application draft (email / form)

**Subject:** Issuing API access — Protocol Bank (agent-scoped virtual cards)

> Hello Rain team,
>
> We would like to apply for issuing API access for Protocol Bank, an execution
> and policy layer for AI agents. We want to issue one virtual card per agent,
> funded from a platform treasury, with per-agent limits and a freeze/close
> control. We understand your model: KYC application → per-user contract →
> deposit address → card issuance → encrypted card secrets relayed to the
> browser.
>
> Company: [legal name], [registration number], [jurisdiction]
> Website: [https://…]
> Contact: [name], [role], [email], [phone]
> Expected volume: [50–200 cards in the first 3 months; $10k–$50k monthly load]
> Use case: AI agents paying for online services under a hard budget
>
> Attached: certificate of incorporation, directors/UBO IDs, proof of address,
> bank statement, AML/KYC policy, security overview.
>
> Could you confirm partner/KYB requirements, sandbox access, supported chains
> and countries, card programme/BIN, fee schedule, and the browser-side
> decryption flow for card secrets?
>
> Best regards,
> [name]

**Questions to ask Rain:**
1. What is the partner/KYB process and expected timeline?
2. Which countries and entity types are supported?
3. Is the sandbox available before KYB? What are its limits?
4. What are the issuance, load, FX and dispute fees?
5. Which chains and stablecoins are supported for the deposit contract?
6. What is the recommended browser-side flow for decrypting PAN/CVC?
7. What webhooks exist (authorisation, settlement, chargeback, card status)?
8. Can one platform issue multiple cards under one user, or does each agent need a separate user?

---

## 6. Technical integration checklist

### Environment
```bash
# Yativo
YATIVO_API_KEY=
YATIVO_API_SECRET=
YATIVO_CUSTOMER_ID=
YATIVO_BASE_URL=            # optional; defaults to the live crypto API

# Rain
RAIN_API_KEY=
RAIN_API_URL=               # optional; defaults to the dev sandbox
RAIN_WEBHOOK_SECRET=
```

### Endpoints already in the repo
- `lib/services/yativo-client.service.ts` — auth/token, deposit address, cards, top-up, withdraw, terminate
- `lib/services/rain-card.service.ts` — KYC application, contracts, issue/list cards, encrypted secrets, balances
- `lib/services/virtual-card.service.ts` — agent card lifecycle + budget enforcement
- `app/api/agents/[id]/virtual-cards` — list/issue (owner session)
- `app/api/agents/[id]/virtual-cards/[cardId]` — details/fund/freeze/unfreeze/close

### Open work after credentials arrive
- [ ] Yativo: confirm `/auth/token` works and re-issue the key pair; set `YATIVO_CUSTOMER_ID`
- [ ] Rain: run the sandbox KYC → contract → issue flow; store `userId` per owner
- [ ] Card webhooks: authorisation/decline → `AgentActivity` and budget reconciliation
- [ ] PAN/CVV: confirm the provider's details flow; never log plaintext
- [ ] Card controls: map freeze/unfreeze to the provider endpoint (or document local-only)
- [ ] Reconciliation: match provider settlement reports to `AgentVirtualCard.balance`
- [ ] KYC UI: collect owner/agent data required by the provider

---

## 7. What the company must do

1. Choose the entity that will contract with the provider.
2. Complete KYB and sign the provider agreement.
3. Fund the provider balance / deposit account.
4. Provide production API keys and webhook secrets.
5. Confirm the supported jurisdictions and prohibited categories.

The engineering side can prepare everything else; the application itself must be
submitted and signed by the company.
