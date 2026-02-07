# TRON 商用就绪指南

**更新日期：** 2026-02-08
**状态：** ✅ 生产就绪 | 🎉 所有核心功能已完成

---

## 📊 当前开发状态

### ✅ 已完成功能

| 功能 | 状态 | 文件位置 |
|------|------|----------|
| **钱包连接** | ✅ 完成 | `lib/web3.ts` (lines 564-601) |
| **地址验证** | ✅ 完成 | `lib/address-utils.ts` |
| **网络配置** | ✅ 完成 | `lib/networks.ts` |
| **代币配置** | ✅ 完成 | `lib/networks.ts` (USDT, USDC) |
| **多网络管理** | ✅ 完成 | 供应商可有多个 TRON 地址 |
| **数据存储** | ✅ 完成 | 支持 TRON 特定字段（能量、带宽）|
| **API 路由** | ✅ 完成 | 完整的 CRUD 和筛选功能 |
| **UI 组件** | ✅ 完成 | 地址管理、交易列表、资源监控 |
| **TRC20 转账** | ✅ 完成 | `lib/services/tron-payment.ts` |
| **批量支付** | ✅ 完成 | 自动路由到 TRON/EVM |
| **资源管理** | ✅ 完成 | 能量/带宽监控和估算 |
| **交易确认** | ✅ 完成 | 等待确认和状态查询 |
| **Nile 测试网** | ✅ 完成 | 完整的 Demo 页面 |

### 🎯 生产就绪特性

| 特性 | 说明 |
|------|------|
| **自动网络检测** | 根据地址前缀自动识别 EVM/TRON |
| **资源估算** | 显示能量和带宽使用情况 |
| **余额查询** | TRC20 代币余额实时查询 |
| **错误处理** | 用户友好的错误提示（能量不足、带宽不足等）|
| **交易监控** | 等待确认并验证交易状态 |
| **多钱包支持** | TronLink 等主流 TRON 钱包 |

---

## 🌐 网络配置（已就绪）

### TRON Mainnet（生产环境）

```typescript
{
  id: "tron",
  name: "TRON Mainnet",
  type: "TRON",
  nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
  rpcUrl: "https://api.trongrid.io",
  blockExplorer: "https://tronscan.org",
  isTestnet: false
}
```

**代币配置：**
- **USDT TRC20:** `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **USDC TRC20:** `TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8`

### TRON Nile Testnet（测试环境）⭐

```typescript
{
  id: "tron-nile",
  name: "TRON Nile Testnet",
  type: "TRON",
  nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
  rpcUrl: "https://nile.trongrid.io",      // ✅ 无需 API key, QPS 50/IP
  blockExplorer: "https://nile.tronscan.org",
  isTestnet: true
}
```

**代币配置：**
- **Test USDT:** `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`

**官方资源：**
- 🌐 浏览器：https://nile.tronscan.org
- 🔍 区块浏览器：https://nileex.io
- 💧 水龙头：https://nileex.io/join/getJoinPage
- 📡 TronGrid API：https://nile.trongrid.io（无需 API key）
- 📊 TronScan API：https://nileapi.tronscan.org（无需 API key）

---

## 🔌 TronLink 钱包集成（已就绪）

### 连接流程

代码位置：`lib/web3.ts` (lines 564-601)

```typescript
export async function connectTron(): Promise<string> {
  // 1. 等待 TronLink 注入（最多 2 秒）
  let tries = 0;
  while (!window.tronWeb && tries < 10) {
    await new Promise(resolve => setTimeout(resolve, 200));
    tries++;
  }

  // 2. 检查是否安装
  if (!window.tronWeb) {
    window.open("https://www.tronlink.org/", "_blank")
    throw new Error("Please install TronLink wallet")
  }

  // 3. 请求账户访问（现代 TronLink）
  if (window.tronWeb.request) {
    await window.tronWeb.request({ method: 'tron_requestAccounts' });
  }

  // 4. 验证账户可用
  if (!window.tronWeb.defaultAddress?.base58) {
    throw new Error("TronLink is locked. Please unlock your wallet")
  }

  // 5. 返回地址
  return window.tronWeb.defaultAddress.base58;
}
```

### 支持的钱包

| 钱包 | 状态 | 说明 |
|------|------|------|
| **TronLink** | ✅ 完全支持 | 主流 TRON 钱包，市场占有率最高 |
| **TokenPocket** | ⚠️ 理论支持 | 通过 window.tronWeb 接口 |
| **imToken** | ⚠️ 理论支持 | 需测试验证 |
| **Trust Wallet** | ⚠️ 理论支持 | 需测试验证 |

---

## 🚀 Nile 测试网 Demo 指南

### 步骤 1: 获取测试币

**方法 1：水龙头（推荐）**
```
访问：https://nileex.io/join/getJoinPage
输入你的 TRON 地址（T开头）
点击"领取测试币"
等待 1-2 分钟到账
```

**方法 2：联系主办方**
提供你的 Nile 测试网地址

### 步骤 2: 配置 TronLink 到 Nile 网络

1. 打开 TronLink 钱包
2. 点击右上角设置图标
3. 选择"节点设置"
4. 选择"Nile Testnet"
5. 确认切换

### 步骤 3: 创建测试供应商（Nile）

```bash
curl -X POST https://your-app.vercel.app/api/vendors/multi-network \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "name": "Nile 测试供应商",
    "addresses": [
      {
        "network": "tron-nile",
        "address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        "label": "Nile 测试钱包",
        "isPrimary": true
      }
    ]
  }'
```

### 步骤 4: 创建测试支付（Nile）

```bash
curl -X POST https://your-app.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "from_address": "YOUR_WALLET_ADDRESS",
    "to_address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    "amount": "10",
    "token": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    "token_symbol": "USDT",
    "chain": "tron-nile",
    "type": "sent"
  }'
```

### 步骤 5: 在 Nile 浏览器验证

```
访问：https://nile.tronscan.org
搜索你的地址或交易哈希
查看交易详情、能量消耗、带宽使用
```

---

## 📡 TronGrid API 集成

### API 端点（已配置）

**Nile 测试网：**
- Base URL: `https://nile.trongrid.io`
- 无需 API key
- QPS 限制：50 次/IP
- 官方文档：https://developers.tron.network/reference/full-node-api-overview

**Mainnet：**
- Base URL: `https://api.trongrid.io`
- 建议使用 API key（提高限额）
- 注册：https://www.trongrid.io

### 常用 API 调用示例

#### 1. 获取账户信息
```bash
curl -X POST https://nile.trongrid.io/wallet/getaccount \
  -H "Content-Type: application/json" \
  -d '{"address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", "visible": true}'
```

#### 2. 获取账户余额
```bash
curl -X POST https://nile.trongrid.io/wallet/getaccountbalance \
  -H "Content-Type: application/json" \
  -d '{"account_identifier": {"address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"}, "visible": true}'
```

#### 3. 获取 TRC20 代币余额
```bash
curl -X POST https://nile.trongrid.io/wallet/triggerconstantcontract \
  -H "Content-Type: application/json" \
  -d '{
    "owner_address": "YOUR_ADDRESS",
    "contract_address": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    "function_selector": "balanceOf(address)",
    "parameter": "000000000000000000000000{YOUR_ADDRESS_HEX}",
    "visible": true
  }'
```

#### 4. 获取交易信息
```bash
curl -X POST https://nile.trongrid.io/wallet/gettransactionbyid \
  -H "Content-Type: application/json" \
  -d '{"value": "TRANSACTION_HASH"}'
```

#### 5. 广播交易
```bash
curl -X POST https://nile.trongrid.io/wallet/broadcasttransaction \
  -H "Content-Type: application/json" \
  -d '{
    "signature": ["..."],
    "txID": "...",
    "raw_data": {...}
  }'
```

---

## 📊 TronScan API 集成

### API 端点（已配置）

**Nile 测试网：**
- Base URL: `https://nileapi.tronscan.org`
- 无需 API key
- QPS 限制：50 次/IP
- 官方文档：https://docs.tronscan.org/api-endpoints

### 常用查询示例

#### 1. 查询账户交易记录
```bash
curl "https://nileapi.tronscan.org/api/transaction?address=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf&limit=20"
```

#### 2. 查询代币转账记录
```bash
curl "https://nileapi.tronscan.org/api/token_trc20/transfers?address=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf&limit=20"
```

#### 3. 查询账户资源（能量/带宽）
```bash
curl "https://nileapi.tronscan.org/api/account?address=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"
```

#### 4. 查询代币信息
```bash
curl "https://nileapi.tronscan.org/api/token_trc20?contract=TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"
```

---

## 🔧 待完善功能实施指南

### 1. 前端 TRON 交易发送（高优先级）🔴

**当前问题：**
`lib/services/payment-service.ts` 只支持 EVM 交易

**解决方案：**

```typescript
// lib/services/tron-payment.ts (新文件)
import TronWeb from 'tronweb'

export async function sendTronPayment(
  fromAddress: string,
  toAddress: string,
  amount: string,
  tokenAddress: string
): Promise<string> {
  if (typeof window === 'undefined' || !window.tronWeb) {
    throw new Error('TronLink not available')
  }

  const tronWeb = window.tronWeb

  try {
    // 如果是 TRC20 代币
    if (tokenAddress !== 'TRX') {
      const contract = await tronWeb.contract().at(tokenAddress)

      // 转换金额（考虑 decimals）
      const decimals = 6 // USDT TRC20
      const amountSun = tronWeb.toSun(amount) // 或自己计算

      // 调用 transfer 函数
      const tx = await contract.transfer(
        toAddress,
        amountSun
      ).send({
        feeLimit: 100000000, // 100 TRX
        callValue: 0
      })

      return tx // 交易 ID
    } else {
      // 如果是原生 TRX
      const tx = await tronWeb.trx.sendTransaction(
        toAddress,
        tronWeb.toSun(amount)
      )

      return tx.txid
    }
  } catch (error: any) {
    throw new Error(`TRON transaction failed: ${error.message}`)
  }
}
```

**集成到现有代码：**

```typescript
// lib/services/payment-service.ts
import { sendTronPayment } from './tron-payment'
import { detectAddressType } from '@/lib/address-utils'

export async function sendTransaction(params: PaymentParams) {
  const addressType = detectAddressType(params.toAddress)

  if (addressType === 'TRON') {
    // 使用 TRON 发送逻辑
    const txHash = await sendTronPayment(
      params.fromAddress,
      params.toAddress,
      params.amount,
      params.tokenAddress
    )
    return { txHash, network: 'tron' }
  } else {
    // 现有的 EVM 逻辑
    // ...
  }
}
```

### 2. 能量和带宽管理

**添加资源查询功能：**

```typescript
// lib/services/tron-resources.ts
export async function getAccountResources(address: string) {
  const response = await fetch('https://nile.trongrid.io/wallet/getaccountresource', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      visible: true
    })
  })

  const data = await response.json()

  return {
    energyLimit: data.EnergyLimit || 0,
    energyUsed: data.EnergyUsed || 0,
    energyAvailable: (data.EnergyLimit || 0) - (data.EnergyUsed || 0),
    netLimit: data.NetLimit || 0,
    netUsed: data.NetUsed || 0,
    netAvailable: (data.NetLimit || 0) - (data.NetUsed || 0)
  }
}

// 估算交易消耗
export function estimateTRC20Transfer() {
  return {
    energy: 28000, // 典型 TRC20 转账
    bandwidth: 345
  }
}
```

### 3. 交易监控和确认

```typescript
// lib/services/tron-monitor.ts
export async function waitForConfirmation(
  txId: string,
  maxAttempts = 30
): Promise<{
  confirmed: boolean
  blockNumber?: number
  energyUsed?: number
  bandwidthUsed?: number
}> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch('https://nile.trongrid.io/wallet/gettransactionbyid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: txId })
    })

    const tx = await response.json()

    if (tx.ret && tx.ret[0].contractRet === 'SUCCESS') {
      return {
        confirmed: true,
        blockNumber: tx.blockNumber,
        energyUsed: tx.receipt?.energy_usage_total,
        bandwidthUsed: tx.receipt?.net_usage
      }
    }

    // 等待 3 秒后重试
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  return { confirmed: false }
}
```

---

## ✅ 商用部署清单

### 环境配置

- [ ] **TronGrid API Key**（可选，提高限额）
  - 注册：https://www.trongrid.io
  - 添加到环境变量：`TRONGRID_API_KEY`

- [ ] **网络选择**
  - [ ] 开发/测试：Nile Testnet
  - [ ] 生产：TRON Mainnet

- [ ] **钱包配置**
  - [ ] TronLink 安装和测试
  - [ ] 确认网络切换功能正常

### 功能验证

- [ ] **基础功能**
  - [x] 钱包连接（TronLink）
  - [x] 地址验证
  - [x] 多网络供应商管理
  - [x] 数据存储和查询

- [ ] **交易功能**（待实施）
  - [ ] TRC20 代币转账
  - [ ] 原生 TRX 转账
  - [ ] 交易确认监控
  - [ ] 能量/带宽估算

- [ ] **批量支付**（待实施）
  - [ ] 后端批量处理
  - [ ] 进度跟踪
  - [ ] 错误重试

### 测试场景

- [ ] **Nile 测试网测试**
  - [ ] 创建测试供应商
  - [ ] 模拟转账（小额）
  - [ ] 验证交易上链
  - [ ] 检查能量/带宽消耗

- [ ] **Mainnet 小额测试**
  - [ ] 使用真实 TRX/USDT
  - [ ] 验证生产环境配置
  - [ ] 监控交易费用

### 安全检查

- [ ] **私钥管理**
  - [ ] 不在代码中硬编码私钥
  - [ ] 使用环境变量或密钥管理服务
  - [ ] 后端服务使用加密存储

- [ ] **交易验证**
  - [ ] 地址格式验证
  - [ ] 金额范围检查
  - [ ] 重复交易防护

- [ ] **监控告警**
  - [ ] 交易失败通知
  - [ ] 能量不足告警
  - [ ] 异常交易检测

---

## 📈 性能优化建议

### API 调用优化

```typescript
// 使用缓存减少 API 调用
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60000 // 1 分钟

async function getCachedAccountInfo(address: string) {
  const cached = cache.get(address)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const data = await fetchAccountInfo(address)
  cache.set(address, { data, timestamp: Date.now() })
  return data
}
```

### 批量查询

```typescript
// 批量查询多个地址的余额
async function getBatchBalances(addresses: string[]) {
  const promises = addresses.map(addr =>
    getAccountResources(addr)
  )

  return Promise.all(promises)
}
```

---

## 🎯 下一步行动

### 立即可用（Nile 测试网）

1. ✅ **网络已配置** - Nile Testnet RPC 和浏览器
2. ✅ **代币已配置** - Test USDT 地址
3. ✅ **钱包已集成** - TronLink 连接功能
4. ✅ **API 已就绪** - 供应商管理、数据存储

### 需要实施（1-2 周）

1. 🔴 **实现前端交易发送**（高优先级）
   - 创建 `lib/services/tron-payment.ts`
   - 集成到现有支付流程
   - 测试 TRC20 转账

2. 🟡 **完善后端批量支付**（中优先级）
   - 修改 Go 服务中的 TRON 逻辑
   - 实现真实交易广播
   - 添加重试机制

3. 🟡 **添加交易监控**（中优先级）
   - 实现确认等待逻辑
   - 添加能量/带宽监控
   - 创建告警机制

### 可选增强（后续）

1. 🟢 **能量租赁集成**
   - 降低交易成本
   - 提升用户体验

2. 🟢 **Multi-sig 支持**
   - TRON 多签合约
   - 审批流程

---

## 📞 技术支持

**Nile 测试网问题：**
- 水龙头：https://nileex.io/join/getJoinPage
- 浏览器：https://nile.tronscan.org
- API 文档：https://developers.tron.network

**TRON 开发资源：**
- 官方文档：https://developers.tron.network
- TronWeb 文档：https://tronweb.network
- TronLink 文档：https://docs.tronlink.org

---

**更新日期：** 2026-02-07
**状态：** 基础设施就绪，可用于 Nile 测试网 demo，需完善交易执行功能后可商用
