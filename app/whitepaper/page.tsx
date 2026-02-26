import { Download, FileText, ExternalLink, Bot, Shield, Zap, Globe } from "lucide-react"
import Link from "next/link"

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
        <div className="mb-8 sm:mb-12 border-b border-border pb-8 sm:pb-12">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-500/20">
              Version 2.0
            </span>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Updated Feb 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 tracking-tight text-foreground">
            Protocol Banks Whitepaper
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            AI-Native Web3 Payment Infrastructure. A deep dive into the x402 Protocol, AI Agent Authentication,
            Agent-to-Agent Communication, and the Future of Agentic Finance.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mt-6 sm:mt-8">
            <Link
              href="https://github.com/everest-an/protocol-banks---web3/blob/main/WHITEPAPER.md"
              target="_blank"
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground font-bold rounded hover:bg-primary/90 transition-colors text-sm sm:text-base"
            >
              <FileText className="w-4 h-4" />
              Read Full on GitHub
            </Link>
            <Link
              href="https://github.com/everest-an/protocol-banks---web3"
              target="_blank"
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-muted border border-border text-foreground rounded hover:bg-muted/80 transition-colors text-sm sm:text-base"
            >
              <Download className="w-4 h-4" />
              Source Code
            </Link>
          </div>
        </div>

        <article className="prose prose-neutral dark:prose-invert max-w-none prose-base sm:prose-lg">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">1. Executive Summary</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            As decentralized organizations (DAOs) and AI agents become dominant economic actors, the traditional banking
            stack is becoming obsolete. Protocol Banks introduces a programmable, cross-chain treasury management layer
            designed for the future of work. By abstracting chain-specific complexities and integrating standard
            accounting practices directly with on-chain events, Protocol Banks enables seamless financial operations for
            the next generation of digital enterprises.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            In v2.0, Protocol Banks evolves from a payment platform into <strong className="text-foreground">AI-native payment infrastructure</strong> &mdash;
            any AI agent can discover our services (ERC-8004), authenticate with on-chain identity (SIWE),
            communicate via signed messages (A2A Protocol), and call payment tools directly (MCP Server).
          </p>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">2. The &ldquo;x402&rdquo; Protocol</h2>
          <div className="p-4 sm:p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-100 mb-2">Gasless Enterprise Settlements</h3>
            <p className="text-sm sm:text-base text-blue-600/80 dark:text-blue-200/70 mb-4">
              Protocol Banks leverages the <strong>x402 Protocol</strong> (based on ERC-3009) to separate payment
              <strong> authorization</strong> from <strong>execution</strong>.
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-blue-600/70 dark:text-blue-200/60">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Enables &ldquo;CFO Approval&rdquo; workflows where the approver doesn&apos;t need ETH/Gas.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Allows AI Agents to propose payments securely via EIP-712 signatures.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Facilitates recurring billing and subscriptions on-chain.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Enables machine-to-machine micropayments via HTTP 402 status codes.</span>
              </li>
            </ul>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">3. Market Analysis</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
            Modern Web3 finance teams face a &ldquo;fragmentation trilemma&rdquo; that hinders adoption:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 not-prose">
            <div className="p-4 bg-muted border border-border rounded">
              <h4 className="text-sm sm:text-base text-foreground font-semibold mb-2">Chain Silos</h4>
              <p className="text-muted-foreground text-xs sm:text-sm">Assets split across EVM, Solana, TRON, and Bitcoin layers.</p>
            </div>
            <div className="p-4 bg-muted border border-border rounded">
              <h4 className="text-sm sm:text-base text-foreground font-semibold mb-2">Data Blindness</h4>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Explorers show hashes, not &ldquo;Payroll&rdquo; or &ldquo;Vendor&rdquo; context.
              </p>
            </div>
            <div className="p-4 bg-muted border border-border rounded">
              <h4 className="text-sm sm:text-base text-foreground font-semibold mb-2">Agent Gap</h4>
              <p className="text-muted-foreground text-xs sm:text-sm">
                AI Agents lack standardized ways to discover, authenticate with, and call payment services.
              </p>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">4. Product Architecture</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
            Protocol Banks acts as a non-custodial overlay. We do not hold funds; we orchestrate them.
          </p>
          <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-sm sm:text-base text-muted-foreground list-disc pl-5 sm:pl-6">
            <li>
              <strong className="text-foreground">Unified Batch Engine:</strong> Smart routing logic that bundles
              transactions to minimize gas fees and administrative time. Go payout-engine for 500+ TPS throughput.
            </li>
            <li>
              <strong className="text-foreground">Local-First Privacy:</strong> &ldquo;Wallet Tags&rdquo; and financial metadata are
              encrypted locally or via RLS policies, ensuring your supplier list remains your trade secret.
            </li>
            <li>
              <strong className="text-foreground">Agent-Ready APIs:</strong> Full REST API with API key authentication,
              budget management, payment proposals, auto-execute rules, and webhook notifications.
            </li>
            <li>
              <strong className="text-foreground">Multi-Chain Support:</strong> 9 blockchains (Ethereum, Polygon, Arbitrum,
              Base, Optimism, BNB Chain, Solana, Bitcoin, TRON) with unified address detection and network-specific optimization.
            </li>
          </ul>

          {/* Section 5: AI-Native Architecture */}
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">5. AI-Native Architecture</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            Protocol Banks v2.0 is designed from the ground up as <strong className="text-foreground">AI-native payment infrastructure</strong>.
            Any AI agent &mdash; whether a Claude MCP client, an autonomous trading bot, or a DAO treasury manager &mdash;
            can interact with our payment services through open, standardized protocols.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8 not-prose">
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-purple-500" />
                <h4 className="text-sm sm:text-base text-foreground font-semibold">ERC-8004 Agent Card</h4>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Decentralized identity for AI agents. DID-based discovery via <code className="text-xs">/.well-known/agent.json</code>.
                EIP-191 signed cards prove agent authenticity on-chain.
              </p>
            </div>
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-500" />
                <h4 className="text-sm sm:text-base text-foreground font-semibold">SIWE + JWT Authentication</h4>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                AI agents authenticate using Sign-In with Ethereum (EIP-4361). Private key signs a challenge,
                receives a 1-hour JWT access token and 30-day refresh token. No browser required.
              </p>
            </div>
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-orange-500" />
                <h4 className="text-sm sm:text-base text-foreground font-semibold">A2A Protocol</h4>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Agent-to-Agent communication via JSON-RPC 2.0. Every message carries an EIP-191 signature
                with nonce-based replay protection and a 5-minute timestamp window.
              </p>
            </div>
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-cyan-500" />
                <h4 className="text-sm sm:text-base text-foreground font-semibold">MCP Server</h4>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Model Context Protocol server exposes 8 payment tools. Claude, GPT, and other AI models
                call tools directly via Streamable HTTP or stdio transport.
              </p>
            </div>
          </div>

          {/* Section 6: Authentication Flow */}
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">6. AI Agent Authentication</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
            Protocol Banks implements a three-step SIWE (Sign-In with Ethereum) authentication flow that allows
            AI agents to log in autonomously using only their private key:
          </p>
          <div className="space-y-4 mb-6 sm:mb-8 not-prose">
            <div className="flex gap-3 sm:gap-4 p-4 bg-muted border border-border rounded-lg">
              <span className="shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <h4 className="text-sm sm:text-base text-foreground font-semibold mb-1">Request Nonce</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  <code className="text-xs">GET /api/auth/siwe/nonce</code> &mdash; Server generates a single-use challenge nonce (5-min expiry).
                  The nonce can only be used once to prevent replay attacks.
                </p>
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4 p-4 bg-muted border border-border rounded-lg">
              <span className="shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <h4 className="text-sm sm:text-base text-foreground font-semibold mb-1">Sign &amp; Verify</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  <code className="text-xs">POST /api/auth/siwe/verify</code> &mdash; Agent constructs an EIP-4361 message, signs it with their
                  private key, and submits both. Server verifies the signature, consumes the nonce, and returns a JWT access token (1h)
                  plus a refresh token (30d).
                </p>
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4 p-4 bg-muted border border-border rounded-lg">
              <span className="shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <h4 className="text-sm sm:text-base text-foreground font-semibold mb-1">Auto-Refresh</h4>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  <code className="text-xs">POST /api/auth/siwe/refresh</code> &mdash; Before the access token expires, the agent submits
                  the refresh token to get a new JWT. Sessions persist up to 30 days without re-authentication.
                </p>
              </div>
            </div>
          </div>

          {/* Section 7: Agent Communication */}
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">7. Agent-to-Agent Communication</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
            The A2A Protocol enables standardized, cryptographically secured communication between AI agents.
            External agents can request payments, get quotes, and track transactions &mdash; all through signed JSON-RPC 2.0 messages.
          </p>
          <div className="p-4 sm:p-6 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-orange-700 dark:text-orange-100 mb-2">A2A Message Flow</h3>
            <ul className="space-y-2 text-xs sm:text-sm text-orange-600/70 dark:text-orange-200/60">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><strong>Discovery:</strong> Resolve agent DID via <code className="text-xs">/.well-known/agent.json</code> or <code className="text-xs">/api/agents/cards/resolve</code></span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><strong>Handshake:</strong> Exchange capabilities and supported protocols</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><strong>Request Payment:</strong> Agent sends a signed payment request with amount, token, and recipient</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><strong>Get Quote:</strong> Server returns a fee estimate and execution plan</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                <span><strong>Confirm &amp; Track:</strong> Submit on-chain transaction and track status via task ID</span>
              </li>
            </ul>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            <strong className="text-foreground">Security guarantees:</strong> Every A2A message is verified with EIP-191 signature recovery.
            Nonces are stored in the database with a unique constraint to prevent replay. Messages older than 5 minutes are rejected.
            All interactions are logged to the audit trail.
          </p>

          {/* Section 8: MCP Integration */}
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">8. MCP Server Integration</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
            The Model Context Protocol (MCP) server allows any compatible AI model &mdash; Claude, GPT, or custom agents &mdash;
            to directly invoke payment tools as native function calls. This eliminates the need for wrapper code or API clients.
          </p>
          <div className="overflow-x-auto mb-6 sm:mb-8 not-prose">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-foreground font-semibold">Tool</th>
                  <th className="text-left py-2 px-3 text-foreground font-semibold">Auth</th>
                  <th className="text-left py-2 px-3 text-foreground font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">list_supported_tokens</code></td>
                  <td className="py-2 px-3">None</td>
                  <td className="py-2 px-3">Query supported tokens and networks</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">get_payment_quote</code></td>
                  <td className="py-2 px-3">None</td>
                  <td className="py-2 px-3">Fee estimates for any payment</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">create_payment</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">Create a payment proposal</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">check_payment_status</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">Check payment status by ID</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">list_payments</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">List recent payments</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">create_invoice</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">Generate invoice with payment link</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">list_invoices</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">List invoices</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><code className="text-xs">get_balance</code></td>
                  <td className="py-2 px-3">JWT</td>
                  <td className="py-2 px-3">Query wallet balances per network</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            <strong className="text-foreground">Two transport modes:</strong> Streamable HTTP
            (<code className="text-xs">POST /api/mcp</code>) for web-based clients and stdio
            (<code className="text-xs">pnpm mcp:stdio</code>) for Claude Desktop and CLI integrations.
            Public tools (token list, quotes) require no authentication; all payment operations require a valid JWT.
          </p>

          <div className="mt-8 sm:mt-12 pt-8 sm:pt-12 border-t border-border">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Ready to build AI-native payments?</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Protocol Banks is open-source and ready for integration. Start with the AI Wallet SDK,
              connect your agent via MCP, or explore the A2A protocol for autonomous agent collaboration.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/contact"
                className="text-sm sm:text-base text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1"
              >
                Contact Sales <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
              </Link>
              <Link
                href="https://github.com/everest-an/protocol-banks---web3"
                className="text-sm sm:text-base text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Contribute on GitHub <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
