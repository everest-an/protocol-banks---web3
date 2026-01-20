# Express.js 集成指南

本指南介绍如何在 Express.js 后端项目中集成 ProtocolBanks 支付。

## 安装

```bash
npm install @protocolbanks/sdk express
```

## 项目结构

```
src/
├── index.ts              # 入口文件
├── routes/
│   ├── payment.ts        # 支付路由
│   └── webhook.ts        # Webhook 路由
├── services/
│   └── protocolbanks.ts  # SDK 服务
└── middleware/
    └── webhook.ts        # Webhook 验证中间件
```

## 1. 初始化 SDK

```typescript
// src/services/protocolbanks.ts
import { ProtocolBanksClient } from '@protocolbanks/sdk';

let client: ProtocolBanksClient | null = null;

export async function initializeSDK(): Promise<ProtocolBanksClient> {
  if (!client) {
    client = new ProtocolBanksClient({
      apiKey: process.env.PB_API_KEY!,
      apiSecret: process.env.PB_API_SECRET!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'testnet',
    });
    
    await client.initialize();
    console.log('ProtocolBanks SDK initialized');
  }
  
  return client;
}

export function getClient(): ProtocolBanksClient {
  if (!client) {
    throw new Error('SDK not initialized. Call initializeSDK() first.');
  }
  return client;
}
```

## 2. 支付路由

```typescript
// src/routes/payment.ts
import { Router } from 'express';
import { getClient } from '../services/protocolbanks';

const router = Router();

// 创建支付链接
router.post('/create', async (req, res) => {
  try {
    const { amount, orderId, description } = req.body;
    
    const client = getClient();
    
    const link = client.links.generate({
      to: process.env.MERCHANT_WALLET!,
      amount: amount.toString(),
      token: 'USDC',
      chain: 137,
      orderId,
      memo: description,
      expiryHours: 1,
      webhookUrl: `${process.env.BASE_URL}/webhook`,
    });
    
    res.json({
      success: true,
      data: {
        paymentUrl: link.url,
        paymentId: link.paymentId,
        expiresAt: link.expiresAt,
      },
    });
    
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment' });
  }
});

// 生成 QR 码
router.post('/qr', async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    
    const client = getClient();
    
    const link = client.links.generate({
      to: process.env.MERCHANT_WALLET!,
      amount: amount.toString(),
      token: 'USDC',
      orderId,
    });
    
    const qr = await client.links.generateQR(link, {
      size: 300,
      format: 'svg',
    });
    
    res.json({
      success: true,
      data: {
        qrCode: qr.data,
        paymentUrl: link.url,
      },
    });
    
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QR' });
  }
});

// 验证支付链接
router.post('/verify', async (req, res) => {
  try {
    const { paymentUrl } = req.body;
    
    const client = getClient();
    const result = client.links.verify(paymentUrl);
    
    res.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

export default router;
```

## 3. Webhook 中间件

```typescript
// src/middleware/webhook.ts
import { Request, Response, NextFunction } from 'express';
import { WebhookModule, WEBHOOK_SIGNATURE_HEADER } from '@protocolbanks/sdk';

const webhooks = new WebhookModule();

export function webhookVerification(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] as string;
  
  if (!signature) {
    return res.status(400).json({ error: 'Missing signature header' });
  }
  
  // 需要原始 body
  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  
  const result = webhooks.verify(
    payload,
    signature,
    process.env.PB_WEBHOOK_SECRET!
  );
  
  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }
  
  // 将解析后的事件附加到请求
  (req as any).webhookEvent = result.event;
  next();
}
```

## 4. Webhook 路由

```typescript
// src/routes/webhook.ts
import { Router } from 'express';
import { webhookVerification } from '../middleware/webhook';
import type { WebhookEvent } from '@protocolbanks/sdk';

const router = Router();

// 使用 raw body parser
router.use(express.raw({ type: 'application/json' }));

router.post('/', webhookVerification, async (req, res) => {
  const event = (req as any).webhookEvent as WebhookEvent;
  
  console.log(`Received webhook: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data);
        break;
        
      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;
        
      case 'payment.expired':
        await handlePaymentExpired(event.data);
        break;
        
      case 'batch.completed':
        await handleBatchCompleted(event.data);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handlePaymentCompleted(data: any) {
  const { paymentId, orderId, transactionHash, amount, token } = data;
  
  console.log(`Payment completed: ${paymentId}`);
  console.log(`Order: ${orderId}, Amount: ${amount} ${token}`);
  console.log(`Transaction: ${transactionHash}`);
  
  // 更新数据库
  // await db.orders.update({ where: { id: orderId }, data: { status: 'paid' } });
  
  // 发送确认邮件
  // await sendConfirmationEmail(orderId);
}

async function handlePaymentFailed(data: any) {
  const { paymentId, orderId, error } = data;
  console.log(`Payment failed: ${paymentId}, Error: ${error}`);
}

async function handlePaymentExpired(data: any) {
  const { paymentId, orderId } = data;
  console.log(`Payment expired: ${paymentId}`);
}

async function handleBatchCompleted(data: any) {
  const { batchId, completedCount, failedCount } = data;
  console.log(`Batch completed: ${batchId}, Success: ${completedCount}, Failed: ${failedCount}`);
}

export default router;
```

## 5. 主入口文件

```typescript
// src/index.ts
import express from 'express';
import { initializeSDK } from './services/protocolbanks';
import paymentRoutes from './routes/payment';
import webhookRoutes from './routes/webhook';

const app = express();

// JSON parser (除了 webhook 路由)
app.use((req, res, next) => {
  if (req.path === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// 路由
app.use('/api/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
async function start() {
  try {
    await initializeSDK();
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

## 6. 环境变量

```env
# .env
PB_API_KEY=pk_live_xxx
PB_API_SECRET=sk_live_xxx
PB_WEBHOOK_SECRET=whsec_xxx
MERCHANT_WALLET=0x你的钱包地址
BASE_URL=https://api.yoursite.com
PORT=3000
```

## 完整示例

查看完整示例项目: [github.com/protocolbanks/express-example](https://github.com/protocolbanks/express-example)
