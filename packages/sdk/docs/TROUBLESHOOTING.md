# 故障排除指南

## 常见错误

### PB_AUTH_001: Invalid API Key

**错误信息:** `API key is invalid or not found`

**原因:**
- API Key 格式错误
- 使用了错误环境的 Key (如在生产环境使用测试 Key)
- API Key 已被禁用

**解决方案:**
```typescript
// 确保使用正确的 Key
const client = new ProtocolBanksClient({
  apiKey: 'pk_live_xxx',  // 生产环境
  // apiKey: 'pk_test_xxx', // 测试环境
  environment: 'production',
});
```

---

### PB_AUTH_003: Token Expired

**错误信息:** `Authentication token has expired`

**原因:**
- JWT 令牌过期
- 系统时间不同步

**解决方案:**
```typescript
// SDK 会自动刷新令牌，但如果持续出现此错误：
// 1. 检查系统时间
// 2. 重新初始化客户端
await client.close();
await client.initialize();
```

---

### PB_LINK_001: Invalid Address

**错误信息:** `Invalid wallet address format`

**原因:**
- 地址格式不正确
- 使用了错误链的地址格式

**解决方案:**
```typescript
// EVM 地址 (Ethereum, Polygon, etc.)
const evmAddress = '0x1234567890abcdef1234567890abcdef12345678';

// Solana 地址
const solanaAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

// Bitcoin 地址
const btcAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

// 验证地址
import { isValidAddress } from '@protocolbanks/sdk';
if (!isValidAddress(address)) {
  console.error('Invalid address');
}
```

---

### PB_LINK_007: Homoglyph Detected

**错误信息:** `Address contains suspicious characters (possible homoglyph attack)`

**原因:**
- 地址中包含看起来像拉丁字母但实际是其他字符的 Unicode 字符
- 这是一种常见的钓鱼攻击手段

**解决方案:**
```typescript
import { detectHomoglyphs } from '@protocolbanks/sdk';

const result = detectHomoglyphs(address);
if (result) {
  console.error('Suspicious characters detected:', result.detectedCharacters);
  // 不要使用这个地址！
}
```

---

### PB_RATE_001: Rate Limit Exceeded

**错误信息:** `Too many requests, please slow down`

**原因:**
- 请求频率超过限制
- 默认限制: 100 请求/秒

**解决方案:**
```typescript
// 1. 配置更高的限制 (需要升级套餐)
const client = new ProtocolBanksClient({
  rateLimitConfig: {
    maxRequestsPerSecond: 200,
    maxConcurrent: 100,
  },
});

// 2. 实现重试逻辑
try {
  await client.links.generate({ ... });
} catch (error) {
  if (error.code === 'PB_RATE_001') {
    await sleep(error.retryAfter * 1000);
    // 重试
  }
}
```

---

### PB_BATCH_001: Batch Size Exceeded

**错误信息:** `Batch size exceeds maximum of 500`

**原因:**
- 批量支付收款人数量超过 500

**解决方案:**
```typescript
// 分批处理
const recipients = [...]; // 1000 个收款人

const BATCH_SIZE = 500;
for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
  const batch = recipients.slice(i, i + BATCH_SIZE);
  await client.batch.submit(batch);
}
```

---

### PB_X402_003: Authorization Expired

**错误信息:** `x402 authorization has expired`

**原因:**
- 用户签名时间超过授权有效期 (默认 1 小时)

**解决方案:**
```typescript
// 1. 设置更长的有效期
const auth = await client.x402.createAuthorization({
  to: '0x...',
  amount: '100',
  token: 'USDC',
  chainId: 137,
  validFor: 7200, // 2 小时
});

// 2. 检查是否过期
if (new Date() > auth.expiresAt) {
  // 创建新的授权
  const newAuth = await client.x402.createAuthorization({ ... });
}
```

---

### PB_NET_002: Request Timeout

**错误信息:** `Request timed out`

**原因:**
- 网络连接慢
- 服务器响应慢

**解决方案:**
```typescript
// 增加超时时间
const client = new ProtocolBanksClient({
  timeout: 60000, // 60 秒
  retryConfig: {
    maxRetries: 5,
    initialDelay: 2000,
  },
});
```

---

## Webhook 问题

### Webhook 签名验证失败

**可能原因:**
1. 使用了错误的 Webhook Secret
2. 请求 body 被修改
3. 时间戳超出容差范围

**解决方案:**
```typescript
// 确保使用原始 body
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const payload = req.body.toString(); // 原始字符串
  const signature = req.headers['x-pb-signature'];
  
  const result = webhooks.verify(payload, signature, process.env.WEBHOOK_SECRET);
});
```

### Webhook 未收到

**检查清单:**
1. Webhook URL 是否可公开访问
2. 防火墙是否允许来自 ProtocolBanks 的请求
3. SSL 证书是否有效
4. 服务器是否返回 2xx 状态码

---

## 调试技巧

### 启用调试日志

```typescript
const client = new ProtocolBanksClient({
  logger: {
    debug: (msg, ...args) => console.debug('[PB Debug]', msg, ...args),
    info: (msg, ...args) => console.info('[PB Info]', msg, ...args),
    warn: (msg, ...args) => console.warn('[PB Warn]', msg, ...args),
    error: (msg, ...args) => console.error('[PB Error]', msg, ...args),
  },
});
```

### 检查请求队列状态

```typescript
const stats = client.getQueueStats();
console.log('Queue stats:', stats);
// { queued: 5, active: 10, rps: 45 }
```

### 验证配置

```typescript
console.log('Config:', client.getConfig());
console.log('Supported chains:', client.getSupportedChains());
console.log('Supported tokens:', client.getSupportedTokens());
```

---

## FAQ

### Q: 支持哪些钱包?

A: 支持所有 EVM 兼容钱包 (MetaMask, WalletConnect, Coinbase Wallet 等)、Phantom (Solana)、以及任何 Bitcoin 钱包。

### Q: 手续费是多少?

A: 
- 标准支付: 0.5%
- x402 Gasless: 0.5% + Gas 费用
- 批量支付: 0.3%

### Q: 资金多久到账?

A: 资金直接发送到你的钱包，确认时间取决于区块链:
- Polygon: ~2 秒
- Ethereum: ~12 秒
- Bitcoin: ~10 分钟

### Q: 如何处理退款?

A: 加密货币支付不支持自动退款。你需要手动发送退款交易。

---

## 获取帮助

如果以上方案无法解决你的问题:

- 📧 Email: support@protocolbanks.com
- 💬 Discord: [discord.gg/protocolbanks](https://discord.gg/protocolbanks)
- 🐛 GitHub: [github.com/protocolbanks/sdk/issues](https://github.com/protocolbanks/sdk/issues)
