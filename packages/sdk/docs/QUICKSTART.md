# 5 分钟快速集成指南

本指南帮助你在 5 分钟内完成 ProtocolBanks 加密货币收款集成。

## 选择集成方式

| 方式 | 适用场景 | 难度 |
|------|---------|------|
| [HTML 嵌入](#1-html-嵌入最简单) | 静态网站、WordPress | ⭐ |
| [React 组件](#2-react-组件) | React/Next.js 应用 | ⭐⭐ |
| [服务端 SDK](#3-服务端-sdk) | 自定义后端集成 | ⭐⭐⭐ |

---

## 1. HTML 嵌入（最简单）

只需一行代码，无需任何编程知识。

```html
<script src="https://sdk.protocolbanks.com/checkout.js"
        data-api-key="pk_live_xxx"
        data-amount="100"
        data-token="USDC"
        data-recipient="0x你的钱包地址">
</script>
```

### 自定义按钮

```html
<script src="https://sdk.protocolbanks.com/checkout.js"></script>

<button class="pb-pay-button"
        data-api-key="pk_live_xxx"
        data-amount="50"
        data-token="USDC"
        data-recipient="0x你的钱包地址"
        data-style="branded"
        data-size="large">
  立即支付 50 USDC
</button>
```

### 可用属性

| 属性 | 必填 | 说明 |
|------|------|------|
| `data-api-key` | ✅ | 你的 API Key |
| `data-amount` | ✅ | 支付金额 |
| `data-recipient` | ✅ | 收款钱包地址 |
| `data-token` | ❌ | 代币 (默认 USDC) |
| `data-chain` | ❌ | 链 ID (如 137 = Polygon) |
| `data-order-id` | ❌ | 订单号 |
| `data-callback-url` | ❌ | 支付成功跳转 URL |
| `data-style` | ❌ | 按钮样式: default/minimal/branded |
| `data-dark-mode` | ❌ | 深色模式: true/false |

---

## 2. React 组件

### 安装

```bash
npm install @protocolbanks/sdk @protocolbanks/react
```

### 使用

```tsx
import { CheckoutProvider, PaymentButton, CheckoutModal } from '@protocolbanks/react';

function App() {
  const handleSuccess = (result) => {
    console.log('支付成功!', result.transactionHash);
    // 跳转到成功页面或更新订单状态
  };

  return (
    <CheckoutProvider apiKey="pk_live_xxx">
      <h1>商品详情</h1>
      <p>价格: 100 USDC</p>
      
      <PaymentButton
        amount="100"
        recipientAddress="0x你的钱包地址"
        token="USDC"
        orderId="order_123"
        onSuccess={handleSuccess}
        onError={(err) => console.error(err)}
      />
      
      <CheckoutModal />
    </CheckoutProvider>
  );
}
```

### 自定义主题

```tsx
<CheckoutProvider 
  apiKey="pk_live_xxx"
  theme={{
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    borderRadius: '12px',
    logo: 'https://example.com/logo.png',
    companyName: '我的商店',
    darkMode: false,
  }}
>
  {/* ... */}
</CheckoutProvider>
```

---

## 3. 服务端 SDK

适合需要完全控制支付流程的场景。

### 安装

```bash
npm install @protocolbanks/sdk
```

### 初始化

```typescript
import { ProtocolBanksClient } from '@protocolbanks/sdk';

const client = new ProtocolBanksClient({
  apiKey: process.env.PB_API_KEY!,
  apiSecret: process.env.PB_API_SECRET!,
  environment: 'production',
});

await client.initialize();
```

### 生成支付链接

```typescript
// API 路由: POST /api/create-payment
export async function POST(req: Request) {
  const { amount, orderId } = await req.json();
  
  const link = client.links.generate({
    to: process.env.MERCHANT_WALLET!,
    amount: amount.toString(),
    token: 'USDC',
    chain: 137, // Polygon
    orderId,
    expiryHours: 1,
    webhookUrl: 'https://yoursite.com/api/webhook',
  });
  
  return Response.json({
    paymentUrl: link.url,
    paymentId: link.paymentId,
    expiresAt: link.expiresAt,
  });
}
```

### 处理 Webhook

```typescript
import { createWebhookMiddleware } from '@protocolbanks/sdk';

const verifyWebhook = createWebhookMiddleware(process.env.WEBHOOK_SECRET!);

// API 路由: POST /api/webhook
export async function POST(req: Request) {
  const event = await verifyWebhook({
    body: await req.text(),
    headers: Object.fromEntries(req.headers),
  });
  
  if (event.type === 'payment.completed') {
    const { paymentId, orderId, transactionHash } = event.data;
    
    // 更新订单状态
    await db.orders.update({
      where: { id: orderId },
      data: { 
        status: 'paid',
        txHash: transactionHash,
      },
    });
  }
  
  return Response.json({ received: true });
}
```

---

## 测试环境

在正式上线前，使用测试环境进行开发：

```typescript
const client = new ProtocolBanksClient({
  apiKey: 'pk_test_xxx',
  apiSecret: 'sk_test_xxx',
  environment: 'testnet', // 使用测试网
});
```

测试网支持的链：
- Ethereum Sepolia
- Polygon Mumbai
- Base Goerli

---

## 下一步

- 📖 [完整 API 文档](https://docs.protocolbanks.com)
- 🔧 [Webhook 事件参考](./WEBHOOKS.md)
- 💡 [最佳实践](./BEST_PRACTICES.md)
- ❓ [常见问题](./FAQ.md)

## 获取帮助

- 📧 Email: support@protocolbanks.com
- 💬 Discord: [discord.gg/protocolbanks](https://discord.gg/protocolbanks)
- 🐛 GitHub Issues: [github.com/protocolbanks/sdk/issues](https://github.com/protocolbanks/sdk/issues)
