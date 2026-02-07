# TRON 集成快速开始指南

## 概述

本指南展示如何在现有 Protocol Banks 产品中立即使用 TRON 功能。所有改动都与现有 EVM 功能**无缝集成**。

---

## ✅ 已完成的功能

### 1. TRON 钱包连接（已修复）

**使用方法**：
```tsx
import { useWeb3 } from "@/contexts/web3-context"

function MyComponent() {
  const { connectWallet, wallets, activeChain } = useWeb3()

  const handleConnect = async () => {
    // 连接 TRON 钱包（自动检测 TronLink）
    await connectWallet("TRON")
  }

  return (
    <div>
      {wallets.TRON ? (
        <p>已连接 TRON: {wallets.TRON}</p>
      ) : (
        <button onClick={handleConnect}>连接 TronLink</button>
      )}
    </div>
  )
}
```

**改进内容**：
- ✅ 增加 TronLink 检测延迟容错
- ✅ 添加权限请求逻辑
- ✅ 更好的错误提示

**测试步骤**：
1. 安装 [TronLink Chrome 扩展](https://www.tronlink.org/)
2. 创建/导入钱包
3. 访问你的应用并点击连接按钮
4. 授权连接

---

### 2. 统一网络配置系统

**新文件**：`lib/networks.ts`

**使用方法**：
```typescript
import { ALL_NETWORKS, getNetworkById, getSupportedTokens, getTokenAddress } from "@/lib/networks"

// 获取所有支持的网络
console.log(ALL_NETWORKS) // { ethereum, arbitrum, base, tron, ... }

// 获取特定网络信息
const tronConfig = getNetworkById("tron")
console.log(tronConfig.name) // "TRON Mainnet"
console.log(tronConfig.blockExplorer) // "https://tronscan.org"

// 获取网络支持的代币
const tokens = getSupportedTokens("tron")
console.log(tokens) // [{ address: "TR7...", symbol: "USDT", decimals: 6 }, ...]

// 获取代币地址
const usdtAddress = getTokenAddress("tron", "USDT")
console.log(usdtAddress) // "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
```

**应用场景**：
- Dashboard 网络筛选
- Payment 页面网络选择
- Settings 默认网络配置

---

### 3. 地址自动检测工具

**新文件**：`lib/address-utils.ts`

**使用方法**：
```typescript
import { detectAddressType, validateAddress, getNetworkForAddress } from "@/lib/address-utils"

// 自动检测地址类型
const type1 = detectAddressType("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")
console.log(type1) // "EVM"

const type2 = detectAddressType("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")
console.log(type2) // "TRON"

// 验证地址
const result = validateAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")
console.log(result)
// {
//   isValid: true,
//   type: "TRON",
//   checksumAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"
// }

// 自动选择网络
const network = getNetworkForAddress("TXYZop...")
console.log(network) // "tron"
```

**实战示例 - Batch Payment 自动路由**：
```typescript
// app/(products)/batch-payment/page.tsx
import { validateAddress, getNetworkForAddress } from "@/lib/address-utils"

async function processBatchPayment(recipients: { address: string; amount: string }[]) {
  for (const recipient of recipients) {
    // 1. 验证地址
    const validation = validateAddress(recipient.address)

    if (!validation.isValid) {
      console.error(`Invalid address: ${recipient.address}`)
      continue
    }

    // 2. 自动检测网络
    const network = getNetworkForAddress(recipient.address)
    console.log(`Sending to ${validation.type} network: ${network}`)

    // 3. 根据网络类型调用相应的转账函数
    if (validation.type === "TRON") {
      await sendTronPayment({
        to: validation.checksumAddress!,
        amount: recipient.amount,
        token: "USDT",
      })
    } else {
      await sendEvmPayment({
        to: validation.checksumAddress!,
        amount: recipient.amount,
        token: "USDT",
        network,
      })
    }
  }
}
```

---

### 4. 多网络余额显示组件

**新文件**：`components/dashboard/multi-network-balance.tsx`

**使用方法**：
```tsx
// app/(products)/dashboard/page.tsx
import { MultiNetworkBalance } from "@/components/dashboard/multi-network-balance"

export default function DashboardPage() {
  return (
    <div>
      <MultiNetworkBalance />
      {/* 其他 Dashboard 内容 */}
    </div>
  )
}
```

**功能特性**：
- ✅ 自动聚合 EVM + TRON 余额
- ✅ 网络筛选（All / EVM / TRON）
- ✅ 按网络分组显示
- ✅ 支持多代币（USDT、USDC、DAI）
- ✅ 响应式布局

---

## 🚀 立即可用的集成示例

### 示例 1: 统一支付按钮

```tsx
// components/unified-payment-button.tsx
"use client"

import { useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { validateAddress } from "@/lib/address-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function UnifiedPaymentButton() {
  const { sendToken, wallets } = useWeb3()
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    // 验证地址
    const validation = validateAddress(recipient)

    if (!validation.isValid) {
      alert(`Invalid address: ${validation.error}`)
      return
    }

    // 检查钱包连接
    const isConnected = validation.type === "TRON" ? !!wallets.TRON : !!wallets.EVM

    if (!isConnected) {
      alert(`Please connect your ${validation.type} wallet first`)
      return
    }

    setLoading(true)

    try {
      // 自动路由到正确的网络（无需手动选择）
      const txHash = await sendToken(recipient, amount, "USDT")

      alert(`Payment successful! TxHash: ${txHash}`)
    } catch (error: any) {
      alert(`Payment failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Recipient address (EVM or TRON)"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <Input
        type="number"
        placeholder="Amount (USDT)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Button onClick={handlePay} disabled={loading}>
        {loading ? "Processing..." : "Send Payment"}
      </Button>
    </div>
  )
}
```

**关键点**：
- ✅ 用户无需选择网络（自动检测）
- ✅ 自动验证地址格式
- ✅ 自动路由到正确的钱包

---

### 示例 2: 网络感知的地址输入框

```tsx
// components/smart-address-input.tsx
"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { validateAddress, formatAddress } from "@/lib/address-utils"
import { CheckCircle2, XCircle } from "lucide-react"

interface SmartAddressInputProps {
  value: string
  onChange: (value: string, isValid: boolean, type?: "EVM" | "TRON") => void
  placeholder?: string
}

export function SmartAddressInput({ value, onChange, placeholder }: SmartAddressInputProps) {
  const [validation, setValidation] = useState<ReturnType<typeof validateAddress> | null>(null)

  useEffect(() => {
    if (!value) {
      setValidation(null)
      onChange(value, false)
      return
    }

    const result = validateAddress(value)
    setValidation(result)
    onChange(value, result.isValid, result.type as any)
  }, [value])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value, false)}
          placeholder={placeholder || "Enter EVM or TRON address"}
          className={
            validation
              ? validation.isValid
                ? "border-green-500"
                : "border-red-500"
              : ""
          }
        />
        {validation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validation.isValid ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
        )}
      </div>

      {validation && (
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <>
              <Badge variant={validation.type === "EVM" ? "default" : "secondary"}>
                {validation.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatAddress(validation.checksumAddress!)}
              </span>
            </>
          ) : (
            <span className="text-xs text-red-500">{validation.error}</span>
          )}
        </div>
      )}
    </div>
  )
}
```

**使用方法**：
```tsx
function MyForm() {
  const [address, setAddress] = useState("")
  const [isValid, setIsValid] = useState(false)
  const [networkType, setNetworkType] = useState<"EVM" | "TRON" | undefined>()

  return (
    <SmartAddressInput
      value={address}
      onChange={(value, valid, type) => {
        setAddress(value)
        setIsValid(valid)
        setNetworkType(type)
      }}
    />
  )
}
```

---

### 示例 3: Excel 导入支持混合地址

```typescript
// lib/excel-parser.ts (扩展现有功能)
import { validateAddressBatch } from "@/lib/address-utils"

export function parseExcelForBatchPayment(data: any[]): {
  valid: PaymentRow[]
  invalid: PaymentRow[]
  summary: {
    total: number
    validEVM: number
    validTRON: number
    invalid: number
  }
} {
  const allAddresses = data.map((row) => row.address)

  // 批量验证地址
  const validation = validateAddressBatch(allAddresses)

  const valid: PaymentRow[] = []
  const invalid: PaymentRow[] = []

  for (const row of data) {
    const isValid = validation.valid.includes(row.address)

    if (isValid) {
      valid.push(row)
    } else {
      invalid.push(row)
    }
  }

  return {
    valid,
    invalid,
    summary: {
      total: data.length,
      validEVM: validation.byType.EVM.length,
      validTRON: validation.byType.TRON.length,
      invalid: validation.invalid.length,
    },
  }
}
```

**Excel 格式示例**：
```csv
Recipient,Amount,Token,Notes
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2,100,USDT,Supplier A (EVM)
TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf,200,USDT,Supplier B (TRON)
0x1234567890123456789012345678901234567890,50,USDC,Supplier C (EVM)
```

**处理结果**：
```json
{
  "summary": {
    "total": 3,
    "validEVM": 2,
    "validTRON": 1,
    "invalid": 0
  }
}
```

---

## 📊 现有功能的 TRON 兼容性

| 功能 | EVM 支持 | TRON 支持 | 状态 |
|------|----------|-----------|------|
| 钱包连接 | ✅ | ✅ | 已完成 |
| 余额查询 | ✅ | ✅ | 已完成 |
| 单笔转账 | ✅ | ✅ | 已完成 |
| Batch Payment | ✅ | ✅ (自动检测) | 需测试 |
| Vendor 管理 | ✅ | ⚠️ (需扩展数据库) | 待开发 |
| Transaction History | ✅ | ⚠️ (需扩展数据库) | 待开发 |
| Multi-Sig | ✅ | ❌ (需合约开发) | 待开发 |
| 对账系统 | ⚠️ (基础) | ❌ | 待开发 |

---

## 🔧 下一步开发任务

### 1. 数据库扩展（优先级：高）

**Prisma Schema 更新**：
```prisma
// prisma/schema.prisma

// 扩展 Vendor 支持多网络地址
model VendorAddress {
  id          String   @id @default(cuid())
  vendorId    String
  vendor      Vendor   @relation(fields: [vendorId], references: [id])
  network     String   // "ethereum" | "tron" | "arbitrum"
  address     String
  isPrimary   Boolean  @default(false)

  @@unique([vendorId, network])
}

// 扩展 Transaction 支持多网络
model Transaction {
  id            String   @id @default(cuid())
  userId        String
  network       String   // "ethereum" | "tron" | ...
  chainId       Int?     // EVM only
  txHash        String
  from          String
  to            String
  amount        Decimal
  token         String
  status        String

  // TRON 特有字段
  energyUsed    BigInt?
  bandwidthUsed BigInt?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, network])
}
```

**迁移命令**：
```bash
pnpm prisma migrate dev --name add_multi_network_support
```

---

### 2. API 路由更新（优先级：高）

```typescript
// app/api/payments/send/route.ts
import { getNetworkForAddress } from "@/lib/address-utils"

export async function POST(req: Request) {
  const { to, amount, token } = await req.json()

  // 自动检测网络
  const network = getNetworkForAddress(to)

  // 调用统一的转账函数
  const txHash = await sendPayment({ to, amount, token, network })

  // 记录到数据库（支持多网络）
  await prisma.transaction.create({
    data: {
      userId: req.userId,
      network,
      txHash,
      from: req.userAddress,
      to,
      amount,
      token,
      status: "pending",
    },
  })

  return Response.json({ success: true, txHash })
}
```

---

### 3. Event Indexer 扩展（优先级：中）

**Go 服务扩展**：
```go
// services/event-indexer/internal/indexer/tron.go
type TronIndexer struct {
    client *trongrid.Client
}

func (t *TronIndexer) IndexBlocks(from, to uint64) error {
    // 拉取 TRON 区块
    // 解析 TRC20 Transfer 事件
    // 存储到数据库
}
```

---

## 📝 测试清单

### 功能测试
- [ ] TRON 钱包连接（TronLink）
- [ ] TRON USDT 余额查询
- [ ] TRON 单笔转账
- [ ] EVM + TRON 混合 Batch Payment
- [ ] 地址自动检测（100 个样本）
- [ ] 多网络余额聚合显示

### 集成测试
- [ ] Dashboard 显示 EVM + TRON 余额
- [ ] Batch Payment 自动路由到正确网络
- [ ] Transaction History 显示混合交易
- [ ] Vendor 系统保存多网络地址

### 性能测试
- [ ] 100 笔混合支付性能
- [ ] 余额查询并发测试（10 网络 x 3 代币）
- [ ] 地址验证批量测试（1000 个地址）

---

## 🎯 成功指标

- ✅ TRON 登录成功率 > 95%
- ✅ 混合支付成功率 > 99%
- ✅ 地址检测准确率 = 100%
- ✅ 用户体验评分 > 4.5/5
- ✅ 零学习成本（自动检测）

---

## 📞 支持资源

- **TRON 文档**: https://developers.tron.network/
- **TronGrid API**: https://www.trongrid.io/
- **TronLink**: https://www.tronlink.org/
- **TronWeb SDK**: https://github.com/tronprotocol/tronweb

---

## 🔗 相关文档

- [TRON 商户结算协议计划](./TRON_SETTLEMENT_PROTOCOL_PLAN.md)
- [统一结算集成方案](./UNIFIED_SETTLEMENT_INTEGRATION_PLAN.md)
- [CLAUDE.md](../CLAUDE.md) - 项目总体指南
