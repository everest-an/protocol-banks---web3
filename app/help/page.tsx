import {
  Wallet,
  Layers,
  Shield,
  Network,
  Coins,
  Lock,
  HelpCircle,
  Globe,
  Zap,
  AlertTriangle,
  FileCheck,
  Eye,
  History,
} from "lucide-react"

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">
          Usage Guide & Help Center
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 mb-12 sm:mb-16 leading-relaxed">
          Master the Protocol Bank interface. Learn how to manage multi-chain payments, visualize your financial
          network, and secure your enterprise assets.
        </p>

        <div className="space-y-16">
          {/* Section 1: Getting Started */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-purple-400">
                <Wallet className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Getting Started</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                Protocol Bank supports a multi-chain environment. To begin, click the "Connect Wallet" button in the top
                right corner. We support the following wallets:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong className="text-white">Ethereum & EVM:</strong> MetaMask, Rabby, Coinbase Wallet.
                </li>
                <li>
                  <strong className="text-white">Solana:</strong> Phantom, Solflare.
                </li>
                <li>
                  <strong className="text-white">Bitcoin:</strong> Unisat, Xverse.
                </li>
              </ul>
              <p className="mt-4">
                Once connected, the dashboard will automatically sync your balances for USDT, USDC, and DAI across
                supported networks.
              </p>
            </div>
          </section>

          {/* Section 2: Batch Payments */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Batch Payments & Advanced Protocols</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                The Batch Payment tool allows you to send multiple transactions in a single session. Protocol Bank
                integrates advanced standards to optimize for cost, speed, and cross-chain interoperability.
              </p>

              <div className="grid gap-6 md:grid-cols-2 mt-8">
                {/* X402 / ERC-3009 Card */}
                <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-lg font-bold text-white">X402 & ERC-3009 (Gasless)</h3>
                  </div>
                  <p className="mb-4">
                    <strong>What is it?</strong> ERC-3009 is a standard for "Transfer with Authorization". It allows you
                    to move USDC without holding ETH for gas fees.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <span className="text-white font-medium">Gasless for Sender:</span> You cryptographically sign an
                      authorization message instead of a transaction.
                    </li>
                    <li>
                      <span className="text-white font-medium">Delegated Execution:</span> A third-party relayer pays
                      the gas to submit your transaction.
                    </li>
                    <li>
                      <span className="text-white font-medium">How to use:</span> Toggle "x402 Protocol" in the Batch
                      Payment settings. When prompted, sign the typed data message in your wallet.
                    </li>
                  </ul>
                </div>

                {/* CCTP Card */}
                <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3 mb-4">
                    <Globe className="w-6 h-6 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">CCTP (Cross-Chain)</h3>
                  </div>
                  <p className="mb-4">
                    <strong>What is it?</strong> Circle's Cross-Chain Transfer Protocol (CCTP) enables native USDC
                    transfers between blockchains without traditional lock-and-mint bridges.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>
                      <span className="text-white font-medium">1:1 Efficiency:</span> USDC is burned on the source chain
                      and minted natively on the destination chain.
                    </li>
                    <li>
                      <span className="text-white font-medium">No Slippage:</span> Unlike liquidity pools, you receive
                      exactly what you send (minus network fees).
                    </li>
                    <li>
                      <span className="text-white font-medium">How to use:</span> In Batch Payment, simply select a
                      different <strong>Destination Chain</strong> for any recipient. The system automatically routes
                      via CCTP.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Cost Analysis Report */}
            <div className="mt-8 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-zinc-900/50 p-4 border-b border-zinc-800 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-white">Payment Cost & Efficiency Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-900 text-zinc-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4 font-medium">Payment Method</th>
                      <th className="p-4 font-medium">Network</th>
                      <th className="p-4 font-medium">Avg. Cost (USD)</th>
                      <th className="p-4 font-medium">Settlement Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Standard Transfer (ERC-20)</td>
                      <td className="p-4">Ethereum Mainnet</td>
                      <td className="p-4">$2.00 - $15.00+</td>
                      <td className="p-4">~12 sec (1 Block)</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30 bg-blue-950/10">
                      <td className="p-4 font-medium text-blue-200">x402 Protocol (ERC-3009)</td>
                      <td className="p-4">Ethereum Mainnet</td>
                      <td className="p-4 text-green-400 font-bold">$0.00 (Gasless for User)</td>
                      <td className="p-4">Instant Signature</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30 bg-purple-950/10">
                      <td className="p-4 font-medium text-purple-200">CCTP Cross-Chain</td>
                      <td className="p-4">Eth ↔ Base/Op/Arb</td>
                      <td className="p-4 text-green-400">~ $0.50 (Gas only)</td>
                      <td className="p-4">~13 mins (Finality)</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Layer 2 Transfer</td>
                      <td className="p-4">Optimism / Arbitrum</td>
                      <td className="p-4">$0.01 - $0.10</td>
                      <td className="p-4">~2 sec</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Solana Transfer</td>
                      <td className="p-4">Solana</td>
                      <td className="p-4 text-green-400">&lt; $0.001</td>
                      <td className="p-4">~400 ms</td>
                    </tr>
                    <tr className="hover:bg-zinc-900/30">
                      <td className="p-4 font-medium text-white">Bitcoin Transfer</td>
                      <td className="p-4">Bitcoin Network</td>
                      <td className="p-4">$1.50 - $5.00+</td>
                      <td className="p-4">~10 - 60 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-zinc-900/30 text-xs text-zinc-500 border-t border-zinc-800">
                * Costs are estimates based on average network congestion and token prices. Actual fees may vary.
              </div>
            </div>
          </section>

          {/* Section 3: Wallet Tags */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-400">
                <Network className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Network Visualization</h2>
            </div>
            <div className="prose prose-invert max-w-none text-zinc-400">
              <p>
                The <strong>Wallet Tags</strong> (Entity Network) dashboard provides a visual map of your financial
                relationships.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>
                  <strong className="text-white">Tagging:</strong> Assign names and categories (e.g., "Supplier",
                  "Subsidiary") to wallet addresses.
                </li>
                <li>
                  <strong className="text-white">Interactive Graph:</strong> Visualize payment flows as animated
                  particles. Click nodes to view detailed financial history.
                </li>
                <li>
                  <strong className="text-white">Privacy:</strong> All tags are stored locally or encrypted with your
                  user session. Your labeled data is never exposed publicly.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Security */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-green-400">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Security Architecture</h2>
            </div>

            <p className="text-zinc-400 leading-relaxed">
              Protocol Bank 采用多层次的企业级安全架构，确保您的资产和数据在交易前、交易中、交易后始终受到保护。
            </p>

            {/* Security Feature Grid */}
            <div className="grid gap-4 md:grid-cols-2 mt-6">
              {/* Minimum Authorization */}
              <div className="bg-zinc-900/30 p-5 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <Lock className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-bold text-white">最小授权原则</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li>
                    • <strong className="text-white">精确授权</strong>：每次交易仅授权实际需要的金额，避免无限授权
                  </li>
                  <li>
                    • <strong className="text-white">金额验证</strong>：系统对比 UI 显示金额与实际提交金额，防止篡改
                  </li>
                  <li>
                    • <strong className="text-white">批量限额</strong>：单笔最高 $100,000，单批最高 $500,000
                  </li>
                </ul>
              </div>

              {/* Rate Limiting */}
              <div className="bg-zinc-900/30 p-5 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <h3 className="font-bold text-white">频率限制 (Rate Limiting)</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li>
                    • <strong className="text-white">批量支付</strong>：每小时最多 3 次
                  </li>
                  <li>
                    • <strong className="text-white">单笔支付</strong>：每分钟最多 10 次
                  </li>
                  <li>
                    • <strong className="text-white">API 请求</strong>：自动检测异常流量并阻止
                  </li>
                </ul>
              </div>

              {/* Address Validation */}
              <div className="bg-zinc-900/30 p-5 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <FileCheck className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white">地址校验与防篡改</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li>
                    • <strong className="text-white">EIP-55 校验和</strong>：验证地址大小写混合格式，检测输入错误
                  </li>
                  <li>
                    • <strong className="text-white">同形字符检测</strong>：识别视觉相似的恶意字符 (如西里尔字母)
                  </li>
                  <li>
                    • <strong className="text-white">完整性哈希</strong>：存储地址哈希值，转账前再次验证
                  </li>
                </ul>
              </div>

              {/* Audit Logging */}
              <div className="bg-zinc-900/30 p-5 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <History className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white">审计日志 (Audit Log)</h3>
                </div>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li>
                    • <strong className="text-white">操作记录</strong>：所有支付、修改、登录操作均有日志
                  </li>
                  <li>
                    • <strong className="text-white">地址变更追踪</strong>：供应商钱包地址修改历史完整保存
                  </li>
                  <li>
                    • <strong className="text-white">IP/设备记录</strong>：异常访问可追溯
                  </li>
                </ul>
              </div>
            </div>

            {/* Transaction Lifecycle Security */}
            <div className="mt-8 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-zinc-900/50 p-4 border-b border-zinc-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-white">交易生命周期安全</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                <div className="p-4 flex gap-4">
                  <div className="w-24 shrink-0 text-sm font-medium text-emerald-400">转账前</div>
                  <div className="text-zinc-400 text-sm">
                    <strong className="text-white">输入净化</strong> - 过滤 SQL 注入、XSS 攻击、隐形 Unicode 字符；
                    <strong className="text-white">地址校验</strong> - EIP-55 校验和 + 同形字符检测；
                    <strong className="text-white">金额验证</strong> - 范围、精度、限额检查
                  </div>
                </div>
                <div className="p-4 flex gap-4">
                  <div className="w-24 shrink-0 text-sm font-medium text-blue-400">转账中</div>
                  <div className="text-zinc-400 text-sm">
                    <strong className="text-white">完整性哈希</strong> - 客户端生成交易参数哈希，服务端验证一致性；
                    <strong className="text-white">频率检查</strong> - 实时速率限制防止恶意刷单；
                    <strong className="text-white">审计记录</strong> - 操作立即写入日志
                  </div>
                </div>
                <div className="p-4 flex gap-4">
                  <div className="w-24 shrink-0 text-sm font-medium text-purple-400">转账后</div>
                  <div className="text-zinc-400 text-sm">
                    <strong className="text-white">交易验证</strong> - 链上确认后更新状态；
                    <strong className="text-white">异常告警</strong> - 失败或可疑交易自动触发安全警报；
                    <strong className="text-white">历史保护</strong> - 数据库 RLS 策略防止越权访问
                  </div>
                </div>
                <div className="p-4 flex gap-4">
                  <div className="w-24 shrink-0 text-sm font-medium text-orange-400">长期存储</div>
                  <div className="text-zinc-400 text-sm">
                    <strong className="text-white">地址哈希校验</strong> - 定期验证供应商地址未被篡改；
                    <strong className="text-white">变更历史</strong> - 所有地址修改保留完整记录；
                    <strong className="text-white">访问控制</strong> - Row-Level Security (RLS) 确保数据隔离
                  </div>
                </div>
              </div>
            </div>

            {/* Malicious Content Protection */}
            <div className="mt-6 bg-red-950/20 border border-red-900/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white">恶意内容防护</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-red-300 font-medium mb-1">恶意文本/乱码</p>
                  <p className="text-zinc-400">自动过滤隐形字符、零宽字符、控制字符</p>
                </div>
                <div>
                  <p className="text-red-300 font-medium mb-1">恶意合约地址</p>
                  <p className="text-zinc-400">校验和验证 + 可选黑名单检查</p>
                </div>
                <div>
                  <p className="text-red-300 font-medium mb-1">注入攻击</p>
                  <p className="text-zinc-400">SQL/XSS/脚本标签完全过滤</p>
                </div>
              </div>
            </div>

            {/* Original FAQ Cards */}
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <Lock className="w-5 h-5 text-green-400" />
                  <h3 className="font-bold">Is Protocol Bank Safe?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Yes. We operate on a strict <strong>Zero-Trust / Client-Side Execution</strong> model. The application
                  runs entirely in your browser. Your private keys are managed solely by your wallet (MetaMask, Ledger,
                  etc.) and are never exposed to our servers. We cannot access or move your funds.
                </p>
              </div>

              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold">Where are my funds held?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Your funds always remain in your own non-custodial wallet or on the blockchain itself. Protocol Bank
                  is simply an interface (a "frontend") to interact with the blockchain. We do not hold user deposits.
                </p>
              </div>

              <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800 md:col-span-2">
                <div className="flex items-center gap-3 mb-3 text-white">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold">Is my data private?</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  <strong>Blockchain Data:</strong> All transactions are public on the blockchain. This is the nature of
                  Web3.
                  <br />
                  <strong>Metadata (Tags & Notes):</strong> Your custom data (Vendor Names, Categories, Notes) is
                  encrypted and stored separately. We utilize Row-Level Security (RLS) to ensure that only your
                  authenticated wallet address can read or write this data.
                </p>
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/20 px-3 py-2 rounded border border-green-900/30 w-fit">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Audited & Verified Secure
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
