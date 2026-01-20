# Settlement Checkout - 故障排查和常见问题

## 🔧 故障排查指南

### 批量支付问题

#### 问题 1: 文件上传失败

**症状**: 上传文件时收到错误

**可能原因**:
- 文件格式不支持 (只支持 CSV 和 Excel)
- 文件大小超过限制 (最大 10MB)
- 文件编码不正确
- 网络连接问题

**解决方案**:
```bash
# 1. 检查文件格式
file batch_payment.csv
# 应该输出: CSV text

# 2. 检查文件大小
ls -lh batch_payment.csv
# 应该小于 10MB

# 3. 检查文件编码
file -i batch_payment.csv
# 应该是 UTF-8

# 4. 重新上传
curl -X POST http://localhost:3000/api/batch-payment/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@batch_payment.csv"
```

---

#### 问题 2: 数据验证失败

**症状**: 验证返回错误

**可能原因**:
- 地址格式不正确
- 金额格式不正确
- 代币不支持
- 余额不足

**解决方案**:
```typescript
// 检查地址格式
const isValidAddress = (address: string) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// 检查金额格式
const isValidAmount = (amount: string) => {
  return /^\d+(\.\d+)?$/.test(amount)
}

// 检查代币支持
const supportedTokens = ['USDC', 'USDT', 'DAI', 'ETH']
const isTokenSupported = (token: string) => {
  return supportedTokens.includes(token)
}

// 检查余额
const hasEnoughBalance = async (address: string, amount: string) => {
  const balance = await provider.getBalance(address)
  return balance.gte(ethers.utils.parseEther(amount))
}
```

---

#### 问题 3: 交易失败

**症状**: 支付提交后交易失败

**可能原因**:
- Gas 不足
- Nonce 冲突
- 账户被锁定
- 网络拥堵

**解决方案**:
```typescript
// 检查 Gas
const gasEstimate = await contract.estimateGas.batchTransfer(recipients)
const gasPrice = await provider.getGasPrice()
const totalGasCost = gasEstimate.mul(gasPrice)

// 检查 Nonce
const nonce = await provider.getTransactionCount(address)
console.log('Current nonce:', nonce)

// 检查账户状态
const balance = await provider.getBalance(address)
console.log('Balance:', ethers.utils.formatEther(balance))

// 重试交易
const tx = await contract.batchTransfer(recipients, {
  gasLimit: gasEstimate.mul(120).div(100), // 增加 20%
  gasPrice: gasPrice.mul(120).div(100),    // 增加 20%
  nonce: nonce
})
```

---

#### 问题 4: 进度卡住

**症状**: 支付状态长时间不更新

**可能原因**:
- Go 微服务崩溃
- 数据库连接问题
- WebSocket 连接断开
- 网络问题

**解决方案**:
```bash
# 1. 检查 Go 微服务状态
curl http://localhost:8080/health

# 2. 检查数据库连接
psql -U postgres -d protocol_banks -c "SELECT 1"

# 3. 检查 WebSocket 连接
# 在浏览器控制台中
console.log(ws.readyState)
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

# 4. 重新连接
ws.close()
ws = new WebSocket('wss://...')

# 5. 查看日志
kubectl logs -f deployment/protocol-banks
docker logs -f protocol-banks
```

---

### x402 Gasless 问题

#### 问题 1: 签名无效

**症状**: 签名验证失败

**可能原因**:
- 消息格式不正确
- 域分隔符不匹配
- 签名已过期
- 钱包不支持 EIP-712

**解决方案**:
```typescript
// 验证消息格式
const isValidMessage = (message: any) => {
  return (
    message.from &&
    message.to &&
    message.value &&
    message.validAfter &&
    message.validBefore &&
    message.nonce
  )
}

// 验证域分隔符
const domain = {
  name: "ProtocolBanks",
  version: "1",
  chainId: 1,
  verifyingContract: tokenAddress
}

// 验证签名
const recovered = ethers.utils.recoverAddress(
  ethers.utils.hashMessage(message),
  signature
)
console.log('Recovered address:', recovered)
console.log('Expected address:', userAddress)

// 检查有效期
const now = Math.floor(Date.now() / 1000)
if (now > message.validBefore) {
  console.error('Authorization expired')
}
```

---

#### 问题 2: Nonce 冲突

**症状**: 交易被拒绝，提示 Nonce 已使用

**可能原因**:
- 并发交易
- Nonce 管理错误
- 重复提交

**解决方案**:
```typescript
// 获取当前 Nonce
const currentNonce = await getNonce(userId, tokenAddress, chainId)

// 分配新 Nonce
const nextNonce = currentNonce + 1

// 标记为已使用
await markNonceAsUsed(userId, tokenAddress, chainId, nextNonce)

// 检查已使用的 Nonce
const usedNonces = await getUsedNonces(userId, tokenAddress, chainId)
console.log('Used nonces:', usedNonces)

// 防止并发
const lock = await acquireLock(`nonce:${userId}:${tokenAddress}:${chainId}`)
try {
  const nonce = await getNextNonce(...)
  // 使用 nonce
} finally {
  await releaseLock(lock)
}
```

---

#### 问题 3: Relayer 费用过高

**症状**: Relayer 费用超过预期

**可能原因**:
- Gas 价格上升
- 交易复杂度增加
- Relayer 利润率调整

**解决方案**:
```typescript
// 估算 Relayer 费用
const estimateRelayerFee = async (authorization: any) => {
  const gasEstimate = await estimateGas(authorization)
  const gasPrice = await provider.getGasPrice()
  const gasCost = gasEstimate.mul(gasPrice)
  
  // Relayer 利润率 (通常 10-20%)
  const profitMargin = 0.15
  const relayerFee = gasCost.mul(100 + profitMargin * 100).div(100)
  
  return relayerFee
}

// 比较不同时间的费用
const fees = []
for (let i = 0; i < 5; i++) {
  const fee = await estimateRelayerFee(authorization)
  fees.push(fee)
  await sleep(60000) // 等待 1 分钟
}

// 选择最低费用的时间
const minFee = Math.min(...fees)
console.log('Minimum fee:', minFee)
```

---

### Off-Ramp 问题

#### 问题 1: KYC 验证失败

**症状**: KYC 验证被拒绝

**可能原因**:
- 身份信息不匹配
- 文件质量不清晰
- 地址验证失败
- 国家/地区限制

**解决方案**:
```typescript
// 检查支持的国家
const supportedCountries = ['US', 'CA', 'GB', 'DE', 'FR', ...]
const isCountrySupported = (country: string) => {
  return supportedCountries.includes(country)
}

// 验证身份信息
const validateIdentity = (identity: any) => {
  return (
    identity.firstName &&
    identity.lastName &&
    identity.dateOfBirth &&
    identity.address &&
    identity.city &&
    identity.state &&
    identity.zipCode &&
    identity.country
  )
}

// 检查文件质量
const validateDocument = (file: File) => {
  // 检查文件大小 (1-10MB)
  if (file.size < 1024 * 1024 || file.size > 10 * 1024 * 1024) {
    return false
  }
  
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf']
  if (!validTypes.includes(file.type)) {
    return false
  }
  
  return true
}

// 重新提交
const retryKYC = async (transactionId: string) => {
  const response = await fetch(`/api/offramp/${transactionId}/retry-kyc`, {
    method: 'POST',
    body: JSON.stringify({
      identity: updatedIdentity,
      document: updatedDocument
    })
  })
  return response.json()
}
```

---

#### 问题 2: 汇率变化

**症状**: 最终金额与报价不符

**可能原因**:
- 汇率波动
- 报价过期
- 费用调整

**解决方案**:
```typescript
// 获取实时汇率
const getRealTimeRate = async (token: string, currency: string) => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=${currency}`
  )
  const data = await response.json()
  return data[token][currency]
}

// 检查报价有效期
const isQuoteValid = (quote: any) => {
  const now = Date.now()
  const expiresAt = new Date(quote.expiresAt).getTime()
  return now < expiresAt
}

// 刷新报价
const refreshQuote = async (quoteId: string) => {
  const response = await fetch(`/api/offramp/quote/${quoteId}/refresh`, {
    method: 'POST'
  })
  return response.json()
}

// 设置价格滑点
const calculateMinimumAmount = (amount: string, slippage: number) => {
  const slippageAmount = parseFloat(amount) * (slippage / 100)
  return (parseFloat(amount) - slippageAmount).toString()
}
```

---

#### 问题 3: 银行转账延迟

**症状**: 资金未按时到账

**可能原因**:
- 银行处理延迟
- 账户信息错误
- 金额限制
- 时区差异

**解决方案**:
```typescript
// 检查银行账户信息
const validateBankAccount = (account: any) => {
  return (
    account.accountNumber &&
    account.routingNumber &&
    account.accountHolderName &&
    account.accountType // checking, savings
  )
}

// 检查金额限制
const checkAmountLimits = (amount: string, provider: string) => {
  const limits = {
    coinbase: { min: 100, max: 50000 },
    bridge: { min: 50, max: 100000 },
    transak: { min: 100, max: 50000 }
  }
  
  const limit = limits[provider]
  const amountNum = parseFloat(amount)
  
  return amountNum >= limit.min && amountNum <= limit.max
}

// 查询转账状态
const checkTransferStatus = async (transactionId: string) => {
  const response = await fetch(`/api/offramp/${transactionId}/status`)
  const data = await response.json()
  
  console.log('Status:', data.status)
  console.log('Bank reference:', data.bankReference)
  console.log('Estimated time:', data.estimatedTime)
  
  return data
}

// 联系支持
const contactSupport = async (transactionId: string) => {
  const response = await fetch('/api/support/ticket', {
    method: 'POST',
    body: JSON.stringify({
      type: 'offramp_delay',
      transactionId,
      description: 'Transfer not received'
    })
  })
  return response.json()
}
```

---

## ❓ 常见问题 (FAQ)

### 功能相关

**Q: 批量支付最多支持多少人?**
A: 理论上无限制，但建议单批不超过 10,000 人以保证性能。

**Q: 支持哪些文件格式?**
A: 支持 CSV 和 Excel (.xlsx, .xls) 格式。

**Q: 支持哪些代币?**
A: 支持所有 ERC-20 代币和各链的原生代币 (ETH, MATIC 等)。

**Q: 支持哪些区块链?**
A: 支持 Ethereum, Polygon, Arbitrum, Optimism, Base, BSC。

**Q: 费用是多少?**
A: 0.5% 服务费 + Gas 费用。

---

### 安全相关

**Q: 私钥如何保护?**
A: 使用 Shamir 2-of-3 分片 + AES-256 加密 + PIN 保护。

**Q: 如何防止重放攻击?**
A: 使用 Nonce 机制，每个授权有唯一的 Nonce。

**Q: 如何验证交易?**
A: 所有交易都在链上验证，可以通过 Etherscan 查看。

**Q: 如何恢复账户?**
A: 使用恢复码和 PIN 可以恢复账户。

---

### 性能相关

**Q: 支付需要多长时间?**
A: 平均 <3 秒，取决于网络拥堵情况。

**Q: 吞吐量是多少?**
A: 500+ TPS (每秒交易数)。

**Q: 如何优化性能?**
A: 使用批量处理、缓存、并发处理等技术。

---

### 成本相关

**Q: 如何降低成本?**
A: 使用 Layer 2 (Polygon, Arbitrum)、批量处理、选择低 Gas 时段。

**Q: Off-Ramp 费用是多少?**
A: 1-3%，取决于提供商。

**Q: 有最小金额限制吗?**
A: 批量支付无最小限制，Off-Ramp 最小 $100。

---

### 集成相关

**Q: 如何集成到我的应用?**
A: 使用 API 或 SDK，参考实现指南。

**Q: 支持哪些编程语言?**
A: JavaScript/TypeScript, Python, Go, Java 等。

**Q: 有 SDK 吗?**
A: 有 JavaScript/TypeScript SDK，其他语言的 SDK 正在开发中。

---

### 支持相关

**Q: 如何获得技术支持?**
A: 提交 GitHub Issue 或联系 support@protocolbanks.com。

**Q: 有文档吗?**
A: 有完整的文档，包括 API 规范、实现指南等。

**Q: 有示例代码吗?**
A: 有，参考实现指南中的代码示例。

---

## 🛠️ 调试技巧

### 启用详细日志

```typescript
// 在 .env.local 中设置
DEBUG=protocol-banks:*

// 或在代码中设置
process.env.DEBUG = 'protocol-banks:*'

// 使用 ethers.js 调试
import { ethers } from 'ethers'
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.DEBUG)
```

### 使用浏览器开发者工具

```javascript
// 在浏览器控制台中
// 查看网络请求
console.log(performance.getEntriesByType('resource'))

// 查看 WebSocket 连接
console.log(ws.readyState)

// 查看本地存储
console.log(localStorage)

// 查看 IndexedDB
indexedDB.databases().then(dbs => console.log(dbs))
```

### 使用 curl 测试 API

```bash
# 获取 Token
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 上传文件
curl -X POST http://localhost:3000/api/batch-payment/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@batch_payment.csv"

# 查询状态
curl -X GET http://localhost:3000/api/batch-payment/batch_123abc/status \
  -H "Authorization: Bearer {token}"
```

---

## 📞 获取帮助

### 文档
- [API 规范](./SETTLEMENT_CHECKOUT_API_SPEC.md)
- [实现指南](./SETTLEMENT_CHECKOUT_IMPLEMENTATION_GUIDE.md)
- [快速参考](./SETTLEMENT_CHECKOUT_QUICK_REFERENCE.md)

### 社区
- GitHub Issues: https://github.com/everest-an/protocol-banks---web3/issues
- Discussions: https://github.com/everest-an/protocol-banks---web3/discussions

### 联系方式
- 技术支持: support@protocolbanks.com
- 安全问题: security@protocolbanks.com
- 产品反馈: feedback@protocolbanks.com

---

**最后更新**: 2026-01-21  
**版本**: 1.0  
**用途**: 故障排查和常见问题解答
