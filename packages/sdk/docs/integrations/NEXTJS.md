# Next.js 集成指南

本指南介绍如何在 Next.js 14+ (App Router) 项目中集成 ProtocolBanks 支付。

## 安装依赖

```bash
npm install @protocolbanks/sdk @protocolbanks/react
```

## 项目结构

```
app/
├── api/
│   ├── payment/
│   │   └── route.ts          # 创建支付
│   └── webhook/
│       └── route.ts          # 处理 Webhook
├── checkout/
│   └── page.tsx              # 结账页面
├── success/
│   └── page.tsx              # 支付成功页
└── providers.tsx             # Provider 包装
lib/
└── protocolbanks.ts          # SDK 客户端
```

## 1. 配置环境变量

```env
# .env.local
PB_API_KEY=pk_live_xxx
PB_API_SECRET=sk_live_xxx
PB_WEBHOOK_SECRET=whsec_xxx
MERCHANT_WALLET=0x你的钱包地址
NEXT_PUBLIC_PB_API_KEY=pk_live_xxx
```

## 2. 创建 SDK 客户端

```typescript
// lib/protocolbanks.ts
import { ProtocolBanksClient } from '@protocolbanks/sdk';

let client: ProtocolBanksClient | null = null;

export function getClient(): ProtocolBanksClient {
  if (!client) {
    client = new ProtocolBanksClient({
      apiKey: process.env.PB_API_KEY!,
      apiSecret: process.env.PB_API_SECRET!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'testnet',
    });
  }
  return client;
}
```

## 3. 创建 Provider

```tsx
// app/providers.tsx
'use client';

import { CheckoutProvider } from '@protocolbanks/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CheckoutProvider 
      apiKey={process.env.NEXT_PUBLIC_PB_API_KEY!}
      theme={{
        primaryColor: '#6366f1',
        borderRadius: '12px',
      }}
    >
      {children}
    </CheckoutProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## 4. 创建支付 API

```typescript
// app/api/payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/protocolbanks';

export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, productName } = await req.json();
    
    const client = getClient();
    
    const link = client.links.generate({
      to: process.env.MERCHANT_WALLET!,
      amount: amount.toString(),
      token: 'USDC',
      chain: 137, // Polygon
      orderId,
      memo: `Payment for ${productName}`,
      expiryHours: 1,
      callbackUrl: `${process.env.NEXT_PUBLIC_URL}/success?orderId=${orderId}`,
      webhookUrl: `${process.env.NEXT_PUBLIC_URL}/api/webhook`,
    });
    
    // 保存支付记录到数据库
    // await db.payments.create({ ... });
    
    return NextResponse.json({
      success: true,
      paymentUrl: link.url,
      paymentId: link.paymentId,
      expiresAt: link.expiresAt,
    });
    
  } catch (error) {
    console.error('Payment creation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
```

## 5. 处理 Webhook

```typescript
// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WebhookModule, WEBHOOK_SIGNATURE_HEADER } from '@protocolbanks/sdk';

const webhooks = new WebhookModule();

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get(WEBHOOK_SIGNATURE_HEADER.toLowerCase()) || '';
    
    const result = webhooks.verify(
      payload,
      signature,
      process.env.PB_WEBHOOK_SECRET!
    );
    
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    const event = result.event!;
    
    switch (event.type) {
      case 'payment.completed':
        const { orderId, transactionHash, amount } = event.data as any;
        console.log(`Payment completed: ${orderId}, tx: ${transactionHash}`);
        
        // 更新订单状态
        // await db.orders.update({ where: { id: orderId }, data: { status: 'paid' } });
        break;
        
      case 'payment.failed':
        console.log('Payment failed:', event.data);
        break;
        
      case 'payment.expired':
        console.log('Payment expired:', event.data);
        break;
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
```

## 6. 结账页面

```tsx
// app/checkout/page.tsx
'use client';

import { PaymentButton, CheckoutModal } from '@protocolbanks/react';
import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const router = useRouter();
  
  const handleSuccess = (result: any) => {
    console.log('Payment successful:', result);
    router.push(`/success?txHash=${result.transactionHash}`);
  };
  
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">结账</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <p className="text-lg">商品: Premium Plan</p>
        <p className="text-2xl font-bold">100 USDC</p>
      </div>
      
      <PaymentButton
        amount="100"
        recipientAddress={process.env.NEXT_PUBLIC_MERCHANT_WALLET!}
        token="USDC"
        orderId="order_123"
        variant="default"
        size="lg"
        onSuccess={handleSuccess}
        onError={(err) => console.error(err)}
      >
        使用加密货币支付
      </PaymentButton>
      
      <CheckoutModal />
    </div>
  );
}
```

## 7. 成功页面

```tsx
// app/success/page.tsx
import { Suspense } from 'react';

function SuccessContent({ searchParams }: { searchParams: { txHash?: string } }) {
  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-bold mb-2">支付成功!</h1>
      <p className="text-gray-600 mb-4">感谢您的购买</p>
      
      {searchParams.txHash && (
        <a 
          href={`https://polygonscan.com/tx/${searchParams.txHash}`}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          查看交易详情 →
        </a>
      )}
    </div>
  );
}

export default function SuccessPage({ searchParams }: { searchParams: { txHash?: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent searchParams={searchParams} />
    </Suspense>
  );
}
```

## 完整示例

查看完整示例项目: [github.com/protocolbanks/nextjs-example](https://github.com/protocolbanks/nextjs-example)
