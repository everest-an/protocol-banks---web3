# Documentation Hub

Everything you need to understand, build, and legally operate Protocol Bank —
the AI automated trading product. Start here and follow the links.

---

## 📦 Product

| Document | What it covers |
|---|---|
| [PRD v2 — AI Trading](PRD_V2_AI_TRADING.md) | Product spec: positioning, cockpit design, wallet architecture, strategy & risk parameters, implementation status |
| [Whitepaper](../WHITEPAPER.md) | Product whitepaper: architecture, 3-layer safety model, strategy explanation, roadmap |
| [Usage Guide (live)](https://protocolbanks.com/help) | In-product guide: getting started, cockpit walkthrough, going live, FAQ |

## ⚖️ Legal (read before live trading)

| Document | What it covers |
|---|---|
| [Risk Disclosure](https://protocolbanks.com/risk-disclosure) | **Required reading before live mode**: loss-of-budget, market/tech/regulatory risks |
| [Terms of Service](https://protocolbanks.com/terms) | Non-custodial nature, automated trading terms, no-investment-advice, liability |
| [Privacy Policy](https://protocolbanks.com/privacy) | Data collection, trading data, agent key handling |
| [Legal hub](legal/README.md) | Index of all legal documents |
| [Additional Legal Terms](legal/ADDITIONAL_LEGAL_TERMS.md) | GPL license supplementary terms |

## 🏗️ Engineering

| Document | What it covers |
|---|---|
| [Architecture](ARCHITECTURE.md) | System architecture |
| [Auth System](AUTH_SYSTEM.md) | SIWE + JWT authentication, Shamir secret sharing |
| [Go Services Architecture](GO_SERVICES_ARCHITECTURE.md) | Go microservices (payout-engine, event-indexer, webhook-handler) |
| [Structured Logging](STRUCTURED_LOGGING.md) | Logging conventions |
| [Testing Guide](TESTING_GUIDE.md) | Jest + Playwright + property testing infrastructure |
| [Environment Setup](../ENV_SETUP.md) | Environment variables and configuration |

## 🔐 Security

| Document | What it covers |
|---|---|
| [Security Model](SECURITY.md) | Security architecture overview |
| [Security Audits](security/) | Historical audit reports (append-only records) |

## 🔌 API

| Document | What it covers |
|---|---|
| [OpenAPI Spec](api/openapi.yaml) | REST API specification |
| [Postman Collection](api/postman-collection.json) | API examples for Postman |
| [Example Code](examples/) | Node.js and Python integration examples |
| [llms-full.txt (live)](https://protocolbanks.com/llms-full.txt) | Full AI-readable API reference |

## 🗄️ Legacy (payment-era, not maintained)

| Document | What it covers |
|---|---|
| [Legacy Archive](legacy/README.md) | Batch payments, TRON, yield aggregation, enterprise payment flows — retained for the Business feature set |

---

**Repo front door:** [../README.md](../README.md)
**Changelog:** [../CHANGELOG.md](../CHANGELOG.md)
