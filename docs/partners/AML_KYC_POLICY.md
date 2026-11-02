# AML / KYC Policy — Card Program (draft)

**Version:** 1.0 · **Date:** November 2026 · **Status:** draft for card-provider and counsel review
**Applies to:** Protocol Bank card program (Yativo / Rain issuing partners)

> This is a program policy draft, not legal advice. The card issuer/partner is the
> regulated entity that performs cardholder KYC and owns the AML program; this
> document describes the controls Protocol Bank operates on top of that program.
> Final text must be reviewed by the issuer, local counsel and the Hong Kong
> compliance owner before production.

---

## 1. Purpose and scope

Protocol Bank is an execution and policy layer for AI agents. A user gives an
agent a scoped API key and a budget; the server enforces which operations the
agent may perform (read / trade / pay / swap), a per-call cap, a daily cap and a
coin allowlist. The card program adds a **virtual Visa card per agent**, funded
from a provider-held balance, so an agent can pay for APIs, cloud and SaaS
without holding a card or a bank account.

This policy covers:

- onboarding of the platform account and card applicants;
- identity and business verification, sanctions/PEP screening;
- transaction monitoring and limits on agent cards;
- escalation, recordkeeping, training and review.

It does **not** describe the issuer's own AML program, which governs cardholder
KYC, BIN sponsorship, settlement and regulatory reporting. Those obligations
remain with the issuer/partner.

## 2. Regulatory frame

The program is designed around:

- Hong Kong **Anti-Money Laundering and Counter-Terrorist Financing Ordinance
  (Cap. 615)** and the issuer's supervisory requirements;
- **FATF** recommendations (risk-based approach, CDD, recordkeeping, suspicious
  transaction reporting);
- applicable sanctions lists (UN, OFAC, EU, HKMA/HKMA-equivalent) screened by the
  issuer;
- Hong Kong **Personal Data (Privacy) Ordinance (Cap. 486)** for personal data.

Where the issuer and the platform are in different jurisdictions, the stricter
of the two requirements applies to the program.

## 3. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Card issuer / partner | Cardholder KYC/KYB, sanctions and PEP screening, BIN sponsorship, card balance custody, transaction monitoring at issuer level, SAR/STR filing where required |
| Protocol Bank compliance owner (to be designated before production) | Platform onboarding gate, policy limits, agent/card monitoring, escalation to the issuer, recordkeeping, annual review |
| Protocol Bank engineering | Enforce server-side caps and allowlists, freeze controls, audit logging, secure key handling |
| Support | Receive and triage card/user complaints; escalate suspected abuse |

No card is activated until the provider confirms KYC/KYB approval. The platform
does not open a card for an applicant the provider has not approved.

## 4. Customer due diligence

### 4.1 Platform account

- The user authenticates with a wallet signature, email magic link or OAuth;
  the wallet address is the account identifier.
- API keys are scoped to the account; a card is requested per agent, not per
  anonymous session.
- The platform records the account, agent, card and funding history needed for
  reconciliation and investigations.

### 4.2 Card applicant (per agent)

The provider performs identity verification through its application API. The
platform passes only the data the provider requires and does not create a card
until the provider returns an approved status.

- **Individuals:** government ID, selfie/liveness where required by the issuer,
  address, date of birth, nationality.
- **Businesses/agents acting for a business:** legal name, registration number,
  registered address, directors/UBOs, ownership structure, source of funds.
- **Risk rating:** low / medium / high, assigned by the issuer using its own
  methodology; high-risk applicants require enhanced due diligence and may be
  declined.
- **Source of funds:** USDC from the platform treasury or the cardholder's own
  deposit address, as required by the chosen program model. On-chain funding is
  reconciled to the provider balance.

### 4.3 Prohibited and restricted cases

- No anonymous or unhosted cards.
- No applicants in sanctioned jurisdictions or on applicable sanctions lists.
- No use for illegal goods/services, unlicensed money transmission, or to
  circumvent capital controls.
- The issuer's restricted-jurisdiction and prohibited-business lists apply; the
  platform enforces them at onboarding and on an ongoing basis.

## 5. Transaction monitoring and limits

The platform enforces the following before a card authorization reaches the
issuer:

| Control | Description |
|---|---|
| Per-agent policy | Allowed operations, per-call cap, daily cap, coin allowlist |
| Card limit | Per-card spend limit set at issuance and adjustable by the account owner |
| Velocity | Card authorizations per time window; repeated declines are reviewed |
| Merchant/geo anomalies | Unusual merchant categories or geographies trigger review |
| Freeze | The account owner or support can freeze/close a card immediately |
| Reconciliation | Card balance and transactions are reconciled to provider webhooks daily |

Alerts are triaged by the compliance owner. Suspected money laundering,
sanctions hits or fraud are escalated to the issuer's MLRO and, where required,
reported by the issuer under its own procedures. The platform does not file
SARs on behalf of the issuer.

## 6. Sanctions, PEP and adverse media

- The issuer screens cardholders and beneficial owners against sanctions and PEP
  lists at onboarding and on an ongoing basis.
- The platform screens its own account holders against the same lists where the
  provider exposes the result; a hit blocks card creation until resolved.
- Adverse-media checks are performed for higher-risk applicants as part of the
  issuer's EDD.

## 7. Recordkeeping and data protection

- KYC records are held by the issuer for the period required by its regulator;
  the platform keeps the account, agent, card, limit and transaction records
  needed for reconciliation and investigations for at least five years.
- Personal data is collected for the program only, stored with access controls,
  and shared with the issuer and its service providers under the program
  agreement.
- Data-subject requests are handled under the PDPO and the issuer's policy.

## 8. Training, audit and review

- Annual AML/CTF training for staff with program responsibilities.
- The compliance owner reviews this policy at least annually and after any
  incident, regulatory change or new program/country.
- An independent review of the platform-side controls is commissioned before
  production and every two years thereafter.
- Audit logs for API keys, policy changes, card actions and payment attempts are
  retained and available to the issuer on request.

## 9. Program limits (initial proposal)

| Parameter | Initial value |
|---|---|
| Cards | 50–200 active agents in the first 3 months |
| Monthly card load | $10k–$50k |
| Average ticket | $50–$200 |
| Per-card limit | Set per agent; default $500/month, adjustable |
| Daily platform limit | Per-agent policy cap; account-level review above $5k/day |
| Manual review | New agents above $1k/day, first 30 days |

These are proposals; the issuer's program terms prevail.

## 10. Approval

| Step | Owner | Status |
|---|---|---|
| Policy draft | Protocol Bank | Done |
| Issuer review | Yativo / Rain | Pending |
| Legal review (HK counsel) | Protocol Bank | Pending |
| Compliance owner named | Protocol Bank | **To do** |
| Production approval | Issuer | Pending |

**Program contact:** use the contact form at https://protocolbanks.com/contact
(subject: Card program / compliance). Company registration and UBO documents are
provided separately in the signed KYB submission.
