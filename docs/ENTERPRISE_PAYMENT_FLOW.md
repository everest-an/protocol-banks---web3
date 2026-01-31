# Protocol Banks - 企业客户支付流程文档

**版本:** 1.0.0  
**更新日期:** 2025-01-23

---

## 概述

本文档详细说明企业客户 (B端) 如何使用 Protocol Banks 向其 C端用户收款的完整流程。

---

## 一、角色定义

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           角色关系图                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐                              ┌─────────────────┐
│   企业客户 (B端) │                              │   C端用户       │
│   (Merchant)    │                              │   (Payer)       │
├─────────────────┤                              ├─────────────────┤
│ • 电商平台      │      创建支付链接/二维码      │ • 消费者        │
│ • SaaS 服务商   │ ─────────────────────────►   │ • 订阅用户      │
│ • 内容创作者    │                              │ • 客户          │
│ • 自由职业者    │      ◄─────────────────────  │                 │
│                 │         完成加密支付          │                 │
└─────────────────┘                              └─────────────────┘
         │                                                │
         │                                                │
         ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Protocol Banks 平台                                   │
│                                                                             │
│  • 支付链接生成    • 二维码生成    • 交易处理    • 收单管理                  │
│  • Webhook 通知   • 数据分析      • 安全验证    • 报表导出                  │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 二、企业客户发起支付 (创建收款链接/二维码)

### 2.1 方式一：通过 Web 界面创建

**路径:** `/receive` 页面

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        收款页面 (/receive)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  收款地址: [0x1234...5678]                    [使用我的钱包]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐                          │
│  │  金额: [100.00]     │  │  代币: [USDC ▼]     │                          │
│  └─────────────────────┘  └─────────────────────┘                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  链接有效期: [24小时 ▼]                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔒 x402 协议特性:                                                   │   │
│  │  • 加密签名链接                                                      │   │
│  │  • 防篡改检测                                                        │   │
│  │  • USDC 无 Gas 支付                                                  │   │
│  │  • 自动过期保护                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  生成的支付链接:                                                     │   │
│  │  https://protocol-banks.com/pay?to=0x...&amount=100&token=USDC&...  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [📋 复制链接]  [📱 显示二维码]  [🔒 验证并分享]  [🔗 测试链接]            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ┌─────────────┐                               │   │
│  │                        │ █▀▀▀▀▀▀▀█ │                               │   │
│  │                        │ █ QR    █ │  ← 扫码支付                    │   │
│  │                        │ █ CODE  █ │                               │   │
│  │                        │ █▄▄▄▄▄▄▄█ │                               │   │
│  │                        └─────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

**操作步骤:**
1. 登录 Protocol Banks 平台
2. 进入 `/receive` 收款页面
3. 输入收款地址 (或点击"使用我的钱包"自动填充)
4. 设置收款金额和代币类型 (USDC/USDT/DAI)
5. 选择链接有效期 (1小时/6小时/24小时/3天/7天)
6. 点击"复制链接"或"显示二维码"
7. 将链接/二维码发送给 C端用户


### 2.2 方式二：通过 SDK 集成

**嵌入式支付按钮:**

\`\`\`html
<!-- 在企业客户网站中嵌入 -->
<script src="https://protocol-banks.vercel.app/sdk/protocol-banks.js"></script>
<script>
  // 初始化 SDK
  ProtocolBanks.init({
    merchantName: 'My Store',
    defaultToken: 'USDC'
  });
  
  // 创建支付按钮
  ProtocolBanks.createButton({
    container: '#pay-button',
    to: '0x1234567890abcdef...',  // 企业收款地址
    amount: '99.99',
    token: 'USDC',
    label: 'Pay $99.99'
  });
</script>

<div id="pay-button"></div>
\`\`\`

**生成支付链接 (API):**

\`\`\`javascript
// 通过 SDK 生成支付链接
const paymentLink = ProtocolBanks.createPaymentLink({
  to: '0x1234567890abcdef...',
  amount: '100.00',
  token: 'USDC',
  merchantName: 'My Store',
  description: 'Order #12345'
});

console.log(paymentLink);
// https://protocol-banks.vercel.app/pay?to=0x...&amount=100&token=USDC&merchant=My%20Store
\`\`\`

**弹出支付模态框:**

\`\`\`javascript
// 打开支付弹窗
ProtocolBanks.openPayment({
  to: '0x1234567890abcdef...',
  amount: '50.00',
  token: 'USDC',
  merchantName: 'My Store',
  description: 'Premium Subscription'
});

// 监听支付结果
window.addEventListener('protocolbanks:payment:success', (event) => {
  console.log('Payment successful:', event.detail);
  // { txHash: '0x...', amount: '50.00', token: 'USDC' }
});

window.addEventListener('protocolbanks:payment:error', (event) => {
  console.log('Payment failed:', event.detail);
});
\`\`\`

### 2.3 方式三：通过 API 创建 Invoice

\`\`\`bash
# 创建 Invoice
curl -X POST https://protocol-banks.com/api/invoice \
  -H "Authorization: Bearer pb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "0x1234567890abcdef...",
    "amount": "100.00",
    "token": "USDC",
    "description": "Order #12345",
    "merchantName": "My Store",
    "expiresIn": 86400000
  }'

# 响应
{
  "success": true,
  "invoice": {
    "invoice_id": "inv_abc123",
    "recipient_address": "0x1234...",
    "amount": 100,
    "token": "USDC",
    "status": "pending",
    "signature": "a1b2c3d4...",
    "expires_at": "2025-01-24T12:00:00Z"
  },
  "paymentLink": "https://protocol-banks.com/pay?invoice=inv_abc123&sig=a1b2c3d4",
  "qrCodeData": "data:image/png;base64,..."
}
\`\`\`

---

## 三、C端用户支付流程

### 3.1 用户打开支付链接

当 C端用户点击支付链接或扫描二维码后，会看到以下界面：

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        支付页面 (/pay)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │      💳         │                                 │
│                         └─────────────────┘                                 │
│                                                                             │
│                         Payment Request                                     │
│                    You are paying 100 USDC                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔒 Security Verified    📝 Signed Link                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Recipient:  0x1234...5678                                          │   │
│  │  Amount:     100 USDC                                               │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  🟢 x402 Protocol    Gasless payment enabled                        │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Settlement Method:  [CDP - 0 Fee] (Base Chain)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Fee Preview:                                                        │   │
│  │  Protocol Fee: $0.00 (CDP Settlement)                               │   │
│  │  Network Gas:  ~$0.00 (Gasless via x402)                            │   │
│  │  Total:        100.00 USDC                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️ Connect your wallet to complete this payment securely.                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    [Pay 100 USDC (+$0.00 fee)]                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                      Powered by x402 Protocol                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 3.2 支付流程步骤

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        C端用户支付流程                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: 打开链接
┌──────────────┐
│ 用户点击链接  │
│ 或扫描二维码  │
└──────┬───────┘
       │
       ▼
Step 2: 安全验证
┌──────────────────────────────────────────────────────────────────┐
│ 系统自动验证:                                                     │
│ • 链接签名是否有效                                                │
│ • 链接是否过期                                                    │
│ • 参数是否被篡改                                                  │
│ • 地址格式是否正确                                                │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 3: 连接钱包
┌──────────────────────────────────────────────────────────────────┐
│ 用户选择钱包连接方式:                                             │
│ • MetaMask                                                       │
│ • WalletConnect                                                  │
│ • Coinbase Wallet                                                │
│ • Email 登录 (创建嵌入式钱包)                                     │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 4: 确认支付
┌──────────────────────────────────────────────────────────────────┐
│ 用户点击 "Pay" 按钮                                               │
│                                                                  │
│ USDC 支付 (x402 协议):                                           │
│ • 签署 EIP-3009 授权 (无 Gas)                                    │
│ • 系统执行转账                                                    │
│                                                                  │
│ 其他代币支付:                                                     │
│ • 用户在钱包中确认交易                                            │
│ • 支付 Gas 费用                                                   │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 5: 支付完成
┌──────────────────────────────────────────────────────────────────┐
│ ✅ Payment Successful                                            │
│                                                                  │
│ Amount Paid:     100 USDC                                        │
│ To:              0x1234...5678                                   │
│ Transaction Hash: 0xabcd...ef12                                  │
│                                                                  │
│ [Close Window]                                                   │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

### 3.3 支付方式说明

| 支付方式 | 代币 | Gas 费用 | 结算方式 | 说明 |
|----------|------|----------|----------|------|
| x402 Gasless | USDC | 0 | CDP (Base) | Base 链上 0 手续费 |
| x402 Gasless | USDC | 0 | Relayer | 其他链由 Relayer 代付 |
| 标准转账 | USDT/DAI | 用户支付 | 直接转账 | 用户需支付 Gas |

---

## 四、收单管理和记录后台

### 4.1 交易历史页面 (`/history`)

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Transaction History                                   │
│                    View all your payments and receipts                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Export CSV]  [Reports]                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [All]  [Sent]  [Received]              🔍 Search transactions...   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ↓ Received USDC                                    +100 USDC        │   │
│  │   From: 0xabc1...2345                              $100.00          │   │
│  │   Jan 23, 2025 10:30 AM                   [completed] [🔗]          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ↑ Sent USDC                                        -50 USDC         │   │
│  │   To: 0xdef6...7890                                $50.00           │   │
│  │   Jan 22, 2025 3:15 PM                    [completed] [🔗]          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ↓ Received USDT                                    +250 USDT        │   │
│  │   From: 0x1111...2222                              $250.00          │   │
│  │   Jan 21, 2025 9:00 AM                    [completed] [🔗]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Business Metrics                                                    │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  Total Volume: $12,450.00    Transactions: 156    Avg: $79.81       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 数据分析页面 (`/analytics`)

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Financial Intelligence                                │
│              Advanced analytics and network topology analysis                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Export CSV]  [Export PDF]                                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Payment Network Graph                             │   │
│  │                                                                      │   │
│  │         ○ Vendor A                                                   │   │
│  │        /                                                             │   │
│  │   ● You ─────── ○ Vendor B                                          │   │
│  │        \                                                             │   │
│  │         ○ Vendor C                                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Total Sent   │ │ Transactions │ │ Wallet Tags  │ │ Avg Trans    │      │
│  │ $124,500.50  │ │    1,248     │ │     86       │ │   $99.76     │      │
│  │ Lifetime     │ │ Total made   │ │ Unique tags  │ │ Per payment  │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                             │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐          │
│  │  Payment Trend (7 Days)     │ │  Token Distribution         │          │
│  │  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │          │
│  │  │     📈 Line Chart     │  │ │  │     🥧 Pie Chart      │  │          │
│  │  │                       │  │ │  │   USDC 60%            │  │          │
│  │  │  $5k ─────────────    │  │ │  │   USDT 30%            │  │          │
│  │  │  $3k ─────────────    │  │ │  │   DAI  10%            │  │          │
│  │  │  $1k ─────────────    │  │ │  │                       │  │          │
│  │  └───────────────────────┘  │ │  └───────────────────────┘  │          │
│  └─────────────────────────────┘ └─────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐          │
│  │  Spending by Category       │ │  Top Vendors                │          │
│  │  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │          │
│  │  │  Software    35%      │  │ │  │  Vendor A   $45,000   │  │          │
│  │  │  Marketing   25%      │  │ │  │  Vendor B   $32,000   │  │          │
│  │  │  Operations  20%      │  │ │  │  Vendor C   $18,000   │  │          │
│  │  │  Other       20%      │  │ │  │  Vendor D   $12,000   │  │          │
│  │  └───────────────────────┘  │ │  └───────────────────────┘  │          │
│  └─────────────────────────────┘ └─────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`


### 4.3 管理后台 (`/admin`)

企业客户可以通过管理后台监控系统状态和配置：

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard                                       │
│              System configuration and production readiness                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ System Ready for Production                                      │   │
│  │     2 items require attention                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ 💰 Fee       │ │ 📄 Contracts │ │ 🌐 Domains   │ │ 🔔 Monitoring│      │
│  │ Management   │ │ Deploy/Verify│ │ Whitelist    │ │ Alerts/Logs  │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                             │
│  System Status                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │ [All] [Environment] [Database] [Security] [Contracts] [Domains]     │   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✅ Supabase Database          Connected                    [Ready]  │   │
│  │ ✅ Reown AppKit               Configured                   [Ready]  │   │
│  │ ⚠️ Etherscan API              Optional - for tx verify    [Warning] │   │
│  │ ⚠️ Resend Email Service       Email notifications disabled [Warning] │   │
│  │ ✅ Payments Table             156 records                  [Ready]  │   │
│  │ ✅ Vendors Table              23 records                   [Ready]  │   │
│  │ ⏳ ZetaChain Contract         Not deployed to mainnet     [Pending] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Recent Security Alerts                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │ ⚠️ Suspicious Activity: Multiple failed login attempts from IP...   │   │
│  │ ⚠️ Rate Limit: API rate limit exceeded for endpoint /api/invoice    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.4 Invoice 管理

企业客户可以通过 API 或 Hook 管理 Invoice：

\`\`\`typescript
// 使用 useInvoice Hook 管理 Invoice
import { useInvoice } from '@/hooks/use-invoice';

function InvoiceManager() {
  const { 
    createInvoice, 
    getInvoice, 
    markAsPaid, 
    cancelInvoice,
    copyPaymentLink 
  } = useInvoice();

  // 创建新 Invoice
  const handleCreate = async () => {
    const result = await createInvoice({
      recipientAddress: '0x1234...',
      amount: '100.00',
      token: 'USDC',
      description: 'Order #12345',
      merchantName: 'My Store',
      expiresIn: 86400000 // 24小时
    });
    
    if (result.success) {
      console.log('Payment Link:', result.paymentLink);
      console.log('QR Code:', result.qrCodeData);
    }
  };

  // 查询 Invoice 状态
  const handleQuery = async (invoiceId: string) => {
    const invoice = await getInvoice(invoiceId);
    console.log('Status:', invoice?.status);
  };

  // 取消 Invoice
  const handleCancel = async (invoiceId: string) => {
    await cancelInvoice(invoiceId);
  };
}
\`\`\`

**Invoice 状态流转:**

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Invoice 状态机                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   pending   │ ← 创建时的初始状态
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │    paid     │ │   expired   │ │  cancelled  │
    │  (已支付)   │ │  (已过期)   │ │  (已取消)   │
    └─────────────┘ └─────────────┘ └─────────────┘
\`\`\`

---

## 五、Webhook 通知系统

### 5.1 支持的事件类型

企业客户可以订阅以下 Webhook 事件：

| 事件类型 | 说明 | 触发时机 |
|----------|------|----------|
| `payment.created` | 支付创建 | 用户发起支付时 |
| `payment.completed` | 支付完成 | 链上交易确认后 |
| `payment.failed` | 支付失败 | 交易失败或超时 |
| `batch_payment.created` | 批量支付创建 | 创建批量支付任务 |
| `batch_payment.completed` | 批量支付完成 | 所有支付项完成 |
| `subscription.created` | 订阅创建 | 用户订阅服务 |
| `subscription.payment_due` | 订阅付款到期 | 即将扣款提醒 |
| `subscription.payment_completed` | 订阅付款完成 | 定期扣款成功 |
| `subscription.cancelled` | 订阅取消 | 用户取消订阅 |

### 5.2 创建 Webhook

\`\`\`bash
# 创建 Webhook 订阅
curl -X POST https://protocol-banks.com/api/webhooks \
  -H "Authorization: Bearer pb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Notifications",
    "url": "https://your-server.com/webhooks/protocol-banks",
    "events": ["payment.created", "payment.completed", "payment.failed"],
    "retry_count": 3,
    "timeout_ms": 30000
  }'

# 响应
{
  "success": true,
  "webhook": {
    "id": "wh_abc123",
    "name": "Payment Notifications",
    "url": "https://your-server.com/webhooks/protocol-banks",
    "events": ["payment.created", "payment.completed", "payment.failed"],
    "is_active": true,
    "retry_count": 3,
    "timeout_ms": 30000,
    "created_at": "2025-01-23T10:00:00Z"
  },
  "secret": "whsec_a1b2c3d4e5f6...",
  "message": "Webhook created successfully. Save the secret now - it will not be shown again."
}
\`\`\`

### 5.3 Webhook 请求格式

当事件触发时，Protocol Banks 会向您的服务器发送 POST 请求：

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Webhook 请求示例                                      │
└─────────────────────────────────────────────────────────────────────────────┘

POST https://your-server.com/webhooks/protocol-banks
Headers:
  Content-Type: application/json
  X-Webhook-Signature: sha256=a1b2c3d4e5f6...
  X-Webhook-Timestamp: 1706000000
  X-Webhook-Event: payment.completed
  X-Webhook-ID: del_xyz789

Body:
{
  "event": "payment.completed",
  "timestamp": "2025-01-23T10:30:00Z",
  "data": {
    "payment_id": "pay_abc123",
    "from_address": "0xabc1...2345",
    "to_address": "0x1234...5678",
    "amount": "100.00",
    "token_symbol": "USDC",
    "chain_id": 8453,
    "tx_hash": "0xdef6...7890",
    "status": "completed",
    "created_at": "2025-01-23T10:29:00Z"
  }
}
\`\`\`

### 5.4 验证 Webhook 签名

\`\`\`javascript
// Node.js 示例
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, timestamp, secret) {
  // 构建签名字符串
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  
  // 计算 HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
  
  // 时间安全比较
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express 中间件示例
app.post('/webhooks/protocol-banks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  
  // 验证时间戳 (防止重放攻击)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(400).json({ error: 'Timestamp too old' });
  }
  
  // 验证签名
  if (!verifyWebhookSignature(req.body, signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 处理事件
  const { event, data } = req.body;
  switch (event) {
    case 'payment.completed':
      handlePaymentCompleted(data);
      break;
    case 'payment.failed':
      handlePaymentFailed(data);
      break;
    // ...
  }
  
  res.status(200).json({ received: true });
});
\`\`\`

### 5.5 重试机制

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Webhook 重试策略                                      │
└─────────────────────────────────────────────────────────────────────────────┘

失败后重试间隔:
  • 第 1 次重试: 1 分钟后
  • 第 2 次重试: 5 分钟后
  • 第 3 次重试: 15 分钟后

状态流转:
  pending → delivered (成功)
          → retrying (失败，还有重试次数)
          → failed (失败，重试次数用尽)
\`\`\`

---

## 六、完整支付生命周期

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        完整支付生命周期                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────┐                                                            │
│  │ 1. 企业创建 │                                                            │
│  │   支付链接  │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │  Web UI / SDK / API                                               │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Protocol Banks 平台                               │   │
│  │                                                                      │   │
│  │  • 生成加密签名链接                                                  │   │
│  │  • 创建 Invoice 记录                                                 │   │
│  │  • 触发 payment.created Webhook                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  支付链接 / 二维码                                                │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ 2. 分享给   │                                                            │
│  │   C端用户   │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │  Email / SMS / 社交媒体 / 嵌入网页                                │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ 3. 用户打开 │                                                            │
│  │   支付页面  │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │  验证签名 → 连接钱包 → 确认金额                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ 4. 用户确认 │                                                            │
│  │   并支付    │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │  USDC: EIP-3009 签名 (无 Gas)                                     │
│         │  其他: 标准 ERC-20 转账                                           │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    区块链网络                                        │   │
│  │                                                                      │   │
│  │  Base / Ethereum / Polygon / Arbitrum / Optimism                    │   │
│  │                                                                      │   │
│  │  • 交易广播                                                          │   │
│  │  • 区块确认                                                          │   │
│  │  • 状态更新                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  交易确认                                                         │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Protocol Banks 平台                               │   │
│  │                                                                      │   │
│  │  • 更新 Invoice 状态为 paid                                          │   │
│  │  • 记录交易历史                                                      │   │
│  │  • 触发 payment.completed Webhook                                    │   │
│  │  • 更新分析数据                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  Webhook 通知                                                     │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ 5. 企业收到 │                                                            │
│  │   支付通知  │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │  更新订单状态 / 发货 / 开通服务                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ 6. 完成    │                                                            │
│  │   业务流程  │                                                            │
│  └─────────────┘                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 七、安全特性

### 7.1 支付链接安全

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        支付链接安全机制                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. 加密签名
   ┌─────────────────────────────────────────────────────────────────────┐
   │  链接参数 (to, amount, token, expires) → HMAC-SHA256 签名           │
   │  任何参数被篡改都会导致签名验证失败                                  │
   └─────────────────────────────────────────────────────────────────────┘

2. 时间限制
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 链接有效期: 1小时 ~ 7天 (可配置)                                 │
   │  • 过期链接自动失效                                                  │
   │  • 防止旧链接被滥用                                                  │
   └─────────────────────────────────────────────────────────────────────┘

3. 混合攻击防护
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 检测 URL 参数注入                                                 │
   │  • 防止 XSS 攻击                                                     │
   │  • 地址格式验证                                                      │
   │  • 金额范围检查                                                      │
   └─────────────────────────────────────────────────────────────────────┘

4. x402 协议特性
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • EIP-3009 授权签名 (无需 approve)                                 │
   │  • 单次使用授权 (防止重放)                                          │
   │  • 链上验证                                                          │
   └─────────────────────────────────────────────────────────────────────┘
\`\`\`

### 7.2 Webhook 安全

- HMAC-SHA256 签名验证
- 时间戳防重放攻击 (5分钟窗口)
- HTTPS 强制要求
- Secret 仅在创建时显示一次

---

## 八、集成示例

### 8.1 电商平台集成

\`\`\`javascript
// 订单创建时生成支付链接
async function createOrderPayment(order) {
  const response = await fetch('https://protocol-banks.com/api/invoice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipientAddress: MERCHANT_WALLET,
      amount: order.total.toString(),
      token: 'USDC',
      description: `Order #${order.id}`,
      merchantName: 'My E-commerce Store',
      expiresIn: 3600000, // 1小时
      metadata: {
        order_id: order.id,
        customer_email: order.customer.email
      }
    })
  });
  
  const { paymentLink, invoice } = await response.json();
  
  // 保存 invoice_id 到订单
  await updateOrder(order.id, { invoice_id: invoice.invoice_id });
  
  // 发送支付链接给客户
  await sendEmail(order.customer.email, {
    subject: `Complete your payment for Order #${order.id}`,
    paymentLink
  });
  
  return paymentLink;
}

// Webhook 处理支付完成
app.post('/webhooks/protocol-banks', async (req, res) => {
  // 验证签名...
  
  const { event, data } = req.body;
  
  if (event === 'payment.completed') {
    // 查找对应订单
    const order = await findOrderByInvoice(data.payment_id);
    
    // 更新订单状态
    await updateOrder(order.id, { 
      status: 'paid',
      tx_hash: data.tx_hash 
    });
    
    // 触发发货流程
    await initiateShipment(order);
    
    // 发送确认邮件
    await sendEmail(order.customer.email, {
      subject: `Payment confirmed for Order #${order.id}`,
      txHash: data.tx_hash
    });
  }
  
  res.status(200).json({ received: true });
});
\`\`\`

### 8.2 SaaS 订阅集成

\`\`\`javascript
// 创建订阅支付
async function createSubscriptionPayment(user, plan) {
  const response = await fetch('https://protocol-banks.com/api/invoice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipientAddress: MERCHANT_WALLET,
      amount: plan.price.toString(),
      token: 'USDC',
      description: `${plan.name} Subscription`,
      merchantName: 'My SaaS App',
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        type: 'subscription'
      }
    })
  });
  
  return response.json();
}

// 处理订阅支付完成
if (event === 'payment.completed' && data.metadata?.type === 'subscription') {
  const { user_id, plan_id } = data.metadata;
  
  // 激活用户订阅
  await activateSubscription(user_id, plan_id);
  
  // 设置下次扣款提醒
  await scheduleNextPaymentReminder(user_id, plan_id);
}
\`\`\`

---

## 九、跨链支付流程

### 9.1 场景说明

当企业客户 (收款方) 希望收取 Base 链上的 USDT，但 C端用户 (付款方) 钱包中只有 Ethereum 链上的 USDT 时，Protocol Banks 提供自动跨链支付能力。

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        跨链支付场景                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐                              ┌─────────────────┐
│   C端用户       │                              │   企业客户       │
│   (付款方)      │                              │   (收款方)       │
├─────────────────┤                              ├─────────────────┤
│ 持有资产:       │      跨链支付                │ 期望收到:        │
│ ETH 链 USDT     │ ─────────────────────────►   │ Base 链 USDT    │
│ 100 USDT        │                              │ ~99.5 USDT      │
│                 │                              │ (扣除跨链费用)   │
└─────────────────┘                              └─────────────────┘
         │                                                │
         │                                                │
         ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Protocol Banks 跨链引擎                               │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ Rango DEX   │    │ ZetaChain   │    │ Circle     │                     │
│  │ Aggregator  │    │ Omnichain   │    │ CCTP       │                     │
│  │ (70+ 链)    │    │ (原生跨链)  │    │ (USDC专用) │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                             │
│  自动选择最优路由 → 最低费用 + 最快速度 + 最佳汇率                          │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 9.2 跨链支付技术架构

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        跨链支付技术栈                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         Protocol Banks 前端         │
                    │         /pay 或 /swap 页面          │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         路由选择引擎                 │
                    │                                     │
                    │  1. 检测用户资产链                   │
                    │  2. 检测目标收款链                   │
                    │  3. 查询所有可用路由                 │
                    │  4. 比较费用/时间/滑点              │
                    │  5. 推荐最优方案                     │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Rango Exchange │       │    ZetaChain    │       │   Circle CCTP   │
│                 │       │                 │       │                 │
│ • 70+ 区块链    │       │ • 原生全链协议  │       │ • USDC 专用     │
│ • 100+ DEX      │       │ • BTC 原生支持  │       │ • 官方跨链      │
│ • 20+ 跨链桥    │       │ • 统一流动性    │       │ • 最低费用      │
│ • 最佳价格聚合  │       │ • ZRC-20 标准   │       │ • 最高安全性    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         目标链结算                   │
                    │                                     │
                    │  Base / Ethereum / Polygon / etc.  │
                    │  收款方钱包收到目标代币              │
                    └─────────────────────────────────────┘
\`\`\`

### 9.3 支持的跨链路径

| 源链 | 目标链 | 支持代币 | 预计时间 | 费用范围 |
|------|--------|----------|----------|----------|
| Ethereum | Base | USDC, USDT, ETH | 2-5 分钟 | $2-10 |
| Ethereum | Polygon | USDC, USDT, DAI | 3-10 分钟 | $3-15 |
| Ethereum | Arbitrum | USDC, USDT, ETH | 2-5 分钟 | $2-8 |
| BSC | Base | USDC, USDT, BNB | 3-8 分钟 | $1-5 |
| Polygon | Base | USDC, USDT, MATIC | 2-5 分钟 | $0.5-3 |
| Arbitrum | Base | USDC, USDT, ETH | 1-3 分钟 | $0.5-2 |
| Bitcoin | Base | BTC → USDC | 20-40 分钟 | $5-20 |
| Solana | Base | SOL, USDC | 5-15 分钟 | $1-5 |

### 9.4 跨链支付用户流程

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        C端用户跨链支付流程                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: 打开支付链接
┌──────────────────────────────────────────────────────────────────┐
│ 用户点击企业发送的支付链接                                        │
│ https://protocol-banks.com/pay?to=0x...&amount=100&token=USDT    │
│                              &chain=base  ← 指定收款链            │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 2: 连接钱包 & 检测资产
┌──────────────────────────────────────────────────────────────────┐
│ 系统自动检测:                                                     │
│ • 用户钱包地址                                                    │
│ • 各链上的代币余额                                                │
│ • 发现: ETH 链有 150 USDT，Base 链余额不足                        │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 3: 显示跨链选项
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  💱 Cross-Chain Payment Required                           │   │
│ │                                                            │   │
│ │  You need to pay 100 USDT on Base chain                   │   │
│ │  Your balance: 150 USDT on Ethereum                       │   │
│ │                                                            │   │
│ │  ┌──────────────────────────────────────────────────────┐ │   │
│ │  │  Route 1: ZetaChain (Recommended)                    │ │   │
│ │  │  • Output: 99.7 USDT                                 │ │   │
│ │  │  • Fee: ~$0.30                                       │ │   │
│ │  │  • Time: ~2 minutes                                  │ │   │
│ │  │  [Select]                                            │ │   │
│ │  └──────────────────────────────────────────────────────┘ │   │
│ │  ┌──────────────────────────────────────────────────────┐ │   │
│ │  │  Route 2: Stargate Bridge                            │ │   │
│ │  │  • Output: 99.5 USDT                                 │ │   │
│ │  │  • Fee: ~$0.50                                       │ │   │
│ │  │  • Time: ~1 minute (Fastest)                         │ │   │
│ │  │  [Select]                                            │ │   │
│ │  └──────────────────────────────────────────────────────┘ │   │
│ │  ┌──────────────────────────────────────────────────────┐ │   │
│ │  │  Route 3: LayerZero                                  │ │   │
│ │  │  • Output: 99.8 USDT                                 │ │   │
│ │  │  • Fee: ~$0.20 (Lowest Fee)                          │ │   │
│ │  │  • Time: ~3 minutes                                  │ │   │
│ │  │  [Select]                                            │ │   │
│ │  └──────────────────────────────────────────────────────┘ │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 4: 用户选择路由并确认
┌──────────────────────────────────────────────────────────────────┐
│ 用户选择推荐路由后:                                               │
│ • 显示详细费用明细                                                │
│ • 显示预计到账时间                                                │
│ • 显示最终收款方收到金额                                          │
│                                                                  │
│ [Confirm Cross-Chain Payment]                                    │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 5: 钱包签名
┌──────────────────────────────────────────────────────────────────┐
│ 用户在钱包中签名交易:                                             │
│ • 授权跨链桥合约使用 USDT                                         │
│ • 确认跨链交易                                                    │
│ • 支付源链 Gas 费用                                               │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 6: 跨链执行
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  🔄 Cross-Chain Transfer in Progress                       │   │
│ │                                                            │   │
│ │  ETH USDT ──────────────────────────────► Base USDT       │   │
│ │                                                            │   │
│ │  Step 1: Source chain confirmed ✅                        │   │
│ │  Step 2: Bridge processing... ⏳                          │   │
│ │  Step 3: Target chain pending...                          │   │
│ │                                                            │   │
│ │  Estimated completion: ~2 minutes                         │   │
│ │  [View on Explorer]                                       │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
Step 7: 支付完成
┌──────────────────────────────────────────────────────────────────┐
│ ✅ Cross-Chain Payment Successful                                │
│                                                                  │
│ • Sent: 100 USDT (Ethereum)                                     │
│ • Received: 99.7 USDT (Base)                                    │
│ • Bridge Fee: 0.3 USDT                                          │
│ • Recipient: 0x1234...5678                                      │
│ • TX Hash: 0xabcd...ef12                                        │
│                                                                  │
│ [Close Window]                                                   │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

### 9.5 Rango Exchange 集成详解

Rango 是一个 DEX 聚合器，支持 70+ 区块链和 100+ DEX：

\`\`\`typescript
// lib/rango.ts - 核心功能

// 1. 获取所有可用路由
const { routes } = await rangoService.getAllRoutes(
  { blockchain: 'ETH', symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  { blockchain: 'BASE', symbol: 'USDT', address: '0x...' },
  '100',  // 金额
  1.0     // 滑点 1%
);

// 2. 路由信息结构
interface RangoRoute {
  requestId: string;           // 路由唯一ID
  outputAmount: string;        // 预计输出金额
  outputAmountUsd: number;     // USD 价值
  swaps: RangoSwap[];          // 交换步骤
  tags: RouteTag[];            // 标签 (推荐/最快/最低费用)
  estimatedTimeInSeconds: number;
  totalFeeUsd: number;
  priceImpact: number;
}

// 3. 支持的链
const SUPPORTED_CHAINS = [
  'ETH',        // Ethereum
  'BSC',        // BNB Chain
  'POLYGON',    // Polygon
  'ARBITRUM',   // Arbitrum
  'OPTIMISM',   // Optimism
  'BASE',       // Base
  'AVAX_CCHAIN',// Avalanche
  'ZETA',       // ZetaChain
  'BTC',        // Bitcoin
  'SOLANA',     // Solana
  // ... 70+ 更多链
];
\`\`\`

### 9.6 ZetaChain 全链集成详解

ZetaChain 提供原生全链互操作性，特别适合 BTC 跨链：

\`\`\`typescript
// lib/zetachain.ts - 核心功能

// 1. 获取全链资产余额 (一个地址管理所有链)
const balances = await zetachain.getOmnichainBalances('0x...');
// 返回: ETH, BTC, BNB, SOL 等所有链上的余额

// 2. 跨链交换
const result = await zetachain.crossChainSwap({
  fromChain: 1,           // Ethereum
  toChain: 8453,          // Base
  fromToken: 'USDT',
  toToken: 'USDT',
  amount: '100',
  recipient: '0x...',
  slippage: 0.5
});

// 3. BTC 原生存款 (无需包装)
const btcDepositAddress = await zetachain.getBTCDepositAddress('0x...');
const memo = zetachain.getBTCDepositMemo('0x...');
// 用户直接向此地址发送 BTC，自动桥接到 ZetaChain

// 4. 追踪跨链交易状态
const status = await zetachain.trackCrossChainTx(cctxHash);
// { status: 'processing', progress: 60, currentStep: 'Bridge processing' }
\`\`\`

### 9.7 跨链支付 API

企业客户可以通过 API 创建指定收款链的 Invoice：

\`\`\`bash
# 创建跨链支付 Invoice
curl -X POST https://protocol-banks.com/api/invoice \
  -H "Authorization: Bearer pb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "0x1234567890abcdef...",
    "amount": "100.00",
    "token": "USDT",
    "chain": "base",           # 指定收款链
    "allowCrossChain": true,   # 允许跨链支付
    "description": "Order #12345",
    "merchantName": "My Store"
  }'

# 响应
{
  "success": true,
  "invoice": {
    "invoice_id": "inv_abc123",
    "recipient_address": "0x1234...",
    "amount": 100,
    "token": "USDT",
    "chain": "base",
    "allow_cross_chain": true,
    "status": "pending"
  },
  "paymentLink": "https://protocol-banks.com/pay?invoice=inv_abc123&chain=base&crosschain=true"
}
\`\`\`

### 9.8 跨链费用说明

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        跨链费用构成                                          │
└─────────────────────────────────────────────────────────────────────────────┘

总费用 = 源链 Gas + 跨链桥费用 + 目标链 Gas + 协议费用

┌─────────────────────────────────────────────────────────────────────────────┐
│ 费用类型        │ 说明                           │ 典型范围              │
├─────────────────┼────────────────────────────────┼───────────────────────┤
│ 源链 Gas        │ 发起交易的 Gas 费用            │ $0.5 - $20 (ETH高)    │
│ 跨链桥费用      │ 桥协议收取的服务费             │ $0.1 - $5             │
│ 目标链 Gas      │ 目标链执行的 Gas (通常由桥代付)│ $0 - $1               │
│ 协议费用        │ Protocol Banks 服务费          │ 0% - 0.5%             │
│ 滑点损失        │ 价格波动导致的损失             │ 0.1% - 1%             │
└─────────────────────────────────────────────────────────────────────────────┘

示例: ETH USDT → Base USDT (100 USDT)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 发送金额:     100 USDT                                                      │
│ 源链 Gas:     -$2.00 (ETH Gas)                                             │
│ 桥费用:       -$0.30 (ZetaChain)                                           │
│ 滑点:         -$0.10 (0.1%)                                                │
│ ─────────────────────────────────────────────────────────────────────────  │
│ 收款方收到:   99.60 USDT (Base 链)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 9.9 跨链支付安全机制

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        跨链安全保障                                          │
└─────────────────────────────────────────────────────────────────────────────┘

1. 路由验证
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 只使用经过审计的跨链桥                                           │
   │  • 实时监控桥的流动性和健康状态                                     │
   │  • 自动排除有安全问题的路由                                         │
   └─────────────────────────────────────────────────────────────────────┘

2. 滑点保护
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 默认滑点保护: 1%                                                 │
   │  • 超过滑点自动取消交易                                             │
   │  • 大额交易警告提示                                                 │
   └─────────────────────────────────────────────────────────────────────┘

3. 交易追踪
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 实时追踪跨链交易状态                                             │
   │  • 源链/目标链双重确认                                              │
   │  • 失败交易自动退款机制                                             │
   └─────────────────────────────────────────────────────────────────────┘

4. 金额验证
   ┌─────────────────────────────────────────────────────────────────────┐
   │  • 验证输出金额符合预期                                             │
   │  • 检测异常汇率波动                                                 │
   │  • 防止 MEV 攻击                                                    │
   └─────────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 附录

### A. API 端点汇总

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/invoice` | POST | 创建 Invoice |
| `/api/invoice` | GET | 查询 Invoice |
| `/api/invoice` | PATCH | 更新 Invoice 状态 |
| `/api/webhooks` | POST | 创建 Webhook |
| `/api/webhooks` | GET | 列出 Webhooks |
| `/api/webhooks/[id]` | GET | 获取单个 Webhook |
| `/api/webhooks/[id]` | PATCH | 更新 Webhook |
| `/api/webhooks/[id]` | DELETE | 删除 Webhook |

### B. 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 / 签名验证失败 |
| 404 | 资源不存在 |
| 410 | 链接已过期 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

### C. 支持的代币和链

| 链 | Chain ID | 支持代币 | Gas 模式 |
|----|----------|----------|----------|
| Base | 8453 | USDC, USDT, DAI | Gasless (USDC) |
| Ethereum | 1 | USDC, USDT, DAI | 标准 |
| Polygon | 137 | USDC, USDT, DAI | 低 Gas |
| Arbitrum | 42161 | USDC, USDT, DAI | 低 Gas |
| Optimism | 10 | USDC, USDT, DAI | 低 Gas |
