# Legal Documents

All legal documents governing Protocol Bank. The live pages are the
canonical versions — the copies here are for reference.

| Document | Location | Purpose |
|---|---|---|
| **Risk Disclosure** | https://protocolbanks.com/risk-disclosure | Required reading before enabling live automated trading |
| **Terms of Service** | https://protocolbanks.com/terms | Service terms incl. automated trading and no-investment-advice clauses |
| **Privacy Policy** | https://protocolbanks.com/privacy | Data handling incl. trading data and agent keys |
| **License (GPL-3.0-only)** | ../LICENSE | Source code license |
| **Additional Legal Terms** | [ADDITIONAL_LEGAL_TERMS.md](ADDITIONAL_LEGAL_TERMS.md) | Supplementary terms for the GPL license (infringement & commercial compliance) |

## Acceptance flow (product wiring)

1. The footer links all three legal pages (`/risk-disclosure`, `/privacy`, `/terms`).
2. The **Go Live** flow requires an explicit risk-acknowledgment checkbox
   before the agent approval signature can be submitted
   (`components/trading-live-setup.tsx`).
3. The landing page links the Risk Disclosure next to every live-mode CTA.

## ⚠️ Before accepting real funds

Have these documents reviewed by qualified legal counsel for your
operating jurisdictions. Automated trading of user funds is a regulated
activity in most jurisdictions; the current terms are a technical-team
draft, not legal advice.
