# 多网络 API 使用指南

## 概述

本指南展示如何使用新的多网络功能（EVM + TRON）进行 Vendor 管理和 Transaction 处理。

---

## 1. Vendor 管理 API

### 1.1 创建支持多网络的 Vendor

**Endpoint**: `POST /api/vendors`

**请求体**:
```typescript
{
  "name": "供应商 A",
  "companyName": "ABC Company",
  "email": "vendor@example.com",
  "category": "supplier",
  "tags": ["trusted", "monthly"],
  "addresses": [
    {
      "network": "ethereum",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "label": "主以太坊钱包",
      "isPrimary": true
    },
    {
      "network": "tron",
      "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "label": "TRON 收款地址",
      "isPrimary": false
    },
    {
      "network": "arbitrum",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "label": "Arbitrum 地址",
      "isPrimary": false
    }
  ]
}
```

**响应**:
```typescript
{
  "id": "vendor_abc123",
  "name": "供应商 A",
  "ownerAddress": "0xYourAddress",
  "companyName": "ABC Company",
  "email": "vendor@example.com",
  "category": "supplier",
  "tags": ["trusted", "monthly"],
  "addresses": [
    {
      "id": "addr_eth_001",
      "network": "ethereum",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "label": "主以太坊钱包",
      "isPrimary": true,
      "verifiedAt": null,
      "createdAt": "2026-02-07T10:00:00Z",
      "updatedAt": "2026-02-07T10:00:00Z"
    },
    {
      "id": "addr_tron_001",
      "network": "tron",
      "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "label": "TRON 收款地址",
      "isPrimary": false,
      "verifiedAt": null,
      "createdAt": "2026-02-07T10:00:00Z",
      "updatedAt": "2026-02-07T10:00:00Z"
    }
  ],
  "createdAt": "2026-02-07T10:00:00Z",
  "updatedAt": "2026-02-07T10:00:00Z"
}
```

---

### 1.2 获取 Vendor 详情（包含所有地址）

**Endpoint**: `GET /api/vendors/:id`

**响应**:
```typescript
{
  "id": "vendor_abc123",
  "name": "供应商 A",
  "addresses": [
    {
      "id": "addr_eth_001",
      "network": "ethereum",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      "isPrimary": true
    },
    {
      "id": "addr_tron_001",
      "network": "tron",
      "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "isPrimary": false
    }
  ]
}
```

---

### 1.3 添加新网络地址到现有 Vendor

**Endpoint**: `POST /api/vendors/:id/addresses`

**请求体**:
```typescript
{
  "network": "base",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
  "label": "Base 网络地址",
  "isPrimary": false
}
```

**响应**:
```typescript
{
  "id": "addr_base_001",
  "network": "base",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
  "label": "Base 网络地址",
  "isPrimary": false,
  "createdAt": "2026-02-07T11:00:00Z"
}
```

---

### 1.4 更新 Vendor 地址

**Endpoint**: `PATCH /api/vendors/:vendorId/addresses/:addressId`

**请求体**:
```typescript
{
  "label": "新标签",
  "isPrimary": true  // 设置为主地址
}
```

---

### 1.5 删除 Vendor 地址

**Endpoint**: `DELETE /api/vendors/:vendorId/addresses/:addressId`

**注意**: 不能删除最后一个地址。如果删除主地址，系统会自动设置另一个地址为主地址。

---

### 1.6 获取特定网络的 Vendor 地址

**Endpoint**: `GET /api/vendors/:id/addresses/:network`

**示例**: `GET /api/vendors/vendor_abc123/addresses/tron`

**响应**:
```typescript
{
  "id": "addr_tron_001",
  "network": "tron",
  "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "label": "TRON 收款地址",
  "isPrimary": false
}
```

---

## 2. Transaction API（支持多网络）

### 2.1 记录交易（自动检测网络）

**Endpoint**: `POST /api/transactions`

**请求体**:
```typescript
{
  "fromAddress": "0xYourAddress",
  "toAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",  // TRON 地址
  "amount": "100",
  "token": "USDT",
  "txHash": "abc123...",
  "type": "sent"
}
```

**系统自动处理**:
1. 检测 `toAddress` 是 TRON 地址
2. 设置 `networkType = "TRON"`
3. 设置 `chain = "tron"`
4. `chainId = null` (TRON 没有 chainId)

**响应**:
```typescript
{
  "id": "tx_001",
  "fromAddress": "0xYourAddress",
  "toAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "amount": "100",
  "token": "USDT",
  "chain": "tron",
  "networkType": "TRON",
  "chainId": null,
  "status": "pending",
  "txHash": "abc123...",
  "energyUsed": null,      // 将在链上确认后更新
  "bandwidthUsed": null,   // 将在链上确认后更新
  "createdAt": "2026-02-07T12:00:00Z"
}
```

---

### 2.2 查询交易记录（按网络筛选）

**Endpoint**: `GET /api/transactions?network=tron`

**支持的查询参数**:
- `network`: `ethereum`, `tron`, `arbitrum`, `base`, `bsc`
- `networkType`: `EVM`, `TRON`
- `status`: `pending`, `confirmed`, `failed`
- `startDate`: ISO 8601 日期
- `endDate`: ISO 8601 日期

**示例**:
```
GET /api/transactions?network=tron&status=confirmed
GET /api/transactions?networkType=TRON
GET /api/transactions?startDate=2026-02-01
```

**响应**:
```typescript
{
  "transactions": [
    {
      "id": "tx_001",
      "chain": "tron",
      "networkType": "TRON",
      "amount": "100",
      "token": "USDT",
      "status": "confirmed",
      "energyUsed": "15000",
      "bandwidthUsed": "345",
      "confirmations": 19,
      "blockNumber": "12345678",
      "txHash": "abc123...",
      "createdAt": "2026-02-07T12:00:00Z",
      "completedAt": "2026-02-07T12:01:30Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 2.3 获取网络统计

**Endpoint**: `GET /api/transactions/stats`

**响应**:
```typescript
{
  "byNetwork": {
    "ethereum": {
      "count": 150,
      "totalVolume": "50000",
      "avgAmount": "333.33"
    },
    "tron": {
      "count": 85,
      "totalVolume": "28000",
      "avgAmount": "329.41"
    },
    "arbitrum": {
      "count": 200,
      "totalVolume": "75000",
      "avgAmount": "375"
    }
  },
  "byNetworkType": {
    "EVM": {
      "count": 350,
      "totalVolume": "125000"
    },
    "TRON": {
      "count": 85,
      "totalVolume": "28000"
    }
  }
}
```

---

## 3. Batch Payment API（支持混合网络）

### 3.1 创建批量支付（混合 EVM + TRON 地址）

**Endpoint**: `POST /api/batch-payment/create`

**请求体**:
```typescript
{
  "fromAddress": "0xYourAddress",
  "token": "USDT",
  "recipients": [
    {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",  // EVM
      "amount": "100",
      "label": "供应商 A"
    },
    {
      "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",  // TRON
      "amount": "200",
      "label": "供应商 B"
    },
    {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",  // EVM
      "amount": "150",
      "label": "供应商 C"
    }
  ]
}
```

**系统自动处理**:
1. 自动检测每个地址的网络类型
2. 按网络分组
3. 分别路由到相应的钱包

**响应**:
```typescript
{
  "batchId": "batch_001",
  "totalAmount": 450,
  "totalItems": 3,
  "breakdown": {
    "EVM": {
      "count": 2,
      "amount": 250,
      "addresses": [
        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7"
      ]
    },
    "TRON": {
      "count": 1,
      "amount": 200,
      "addresses": [
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
      ]
    }
  },
  "status": "pending"
}
```

---

### 3.2 执行批量支付

**Endpoint**: `POST /api/batch-payment/execute`

**请求体**:
```typescript
{
  "batchId": "batch_001"
}
```

**响应**:
```typescript
{
  "batchId": "batch_001",
  "status": "processing",
  "results": {
    "EVM": {
      "status": "processing",
      "txHash": "0xabc123...",
      "count": 2,
      "successful": 0,
      "failed": 0
    },
    "TRON": {
      "status": "processing",
      "txHash": "def456...",
      "count": 1,
      "successful": 0,
      "failed": 0
    }
  }
}
```

---

## 4. 使用示例

### 示例 1: 创建多网络 Vendor

```typescript
import { createVendorWithAddresses } from "@/lib/services/vendor-multi-network.service"

const vendor = await createVendorWithAddresses({
  name: "全球供应商",
  ownerAddress: userAddress,
  addresses: [
    {
      network: "ethereum",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      label: "主以太坊地址",
      isPrimary: true,
    },
    {
      network: "tron",
      address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      label: "TRON 支付地址",
    },
  ],
  companyName: "Global Supplier Inc.",
  email: "contact@globalsupplier.com",
  category: "international",
  tags: ["trusted", "wholesale"],
})

console.log(vendor)
// {
//   id: "vendor_123",
//   name: "全球供应商",
//   addresses: [...]
// }
```

---

### 示例 2: 获取 Vendor 的 TRON 地址

```typescript
import { getVendorAddressForNetwork } from "@/lib/services/vendor-multi-network.service"

const tronAddress = await getVendorAddressForNetwork(
  vendorId,
  "tron",
  userAddress
)

if (tronAddress) {
  console.log(`TRON 地址: ${tronAddress.address}`)
  // 可以直接用于支付
  await sendTronPayment(tronAddress.address, "100", "USDT")
}
```

---

### 示例 3: 自动路由支付

```typescript
import { validateAddress, getNetworkForAddress } from "@/lib/address-utils"
import { getVendorAddressForNetwork } from "@/lib/services/vendor-multi-network.service"

async function payVendor(vendorId: string, amount: string, token: string) {
  // 1. 获取 vendor
  const vendor = await getVendorWithAddresses(vendorId, userAddress)

  // 2. 用户选择网络（或自动选择）
  const preferredNetwork = "tron" // 用户偏好 TRON（费用低）

  // 3. 获取对应网络的地址
  const address = await getVendorAddressForNetwork(
    vendorId,
    preferredNetwork,
    userAddress
  )

  if (!address) {
    throw new Error(`Vendor 没有 ${preferredNetwork} 地址`)
  }

  // 4. 执行支付（自动路由）
  const network = getNetworkForAddress(address.address)
  const txHash = await sendPayment({
    to: address.address,
    amount,
    token,
    network,
  })

  // 5. 记录交易
  await prisma.payment.create({
    data: {
      fromAddress: userAddress,
      toAddress: address.address,
      amount,
      token,
      chain: network,
      networkType: network === "tron" ? "TRON" : "EVM",
      txHash,
      vendorId,
      type: "sent",
      status: "pending",
    },
  })

  return txHash
}
```

---

### 示例 4: 查询跨网络交易

```typescript
import { prisma } from "@/lib/prisma"

// 获取所有 TRON 交易
const tronTransactions = await prisma.payment.findMany({
  where: {
    networkType: "TRON",
    createdBy: userAddress,
  },
  orderBy: { createdAt: "desc" },
})

// 获取特定 vendor 的所有网络交易
const vendorTransactions = await prisma.payment.findMany({
  where: {
    vendorId: vendorId,
    createdBy: userAddress,
  },
  include: {
    vendor: {
      include: {
        addresses: true,
      },
    },
  },
  orderBy: { createdAt: "desc" },
})

// 按网络分组统计
const stats = await prisma.$queryRaw`
  SELECT
    network_type,
    chain,
    COUNT(*) as count,
    SUM(CAST(amount AS DECIMAL)) as total_volume
  FROM payments
  WHERE created_by = ${userAddress}
  GROUP BY network_type, chain
  ORDER BY total_volume DESC
`
```

---

## 5. 数据库查询示例

### 5.1 获取 Vendor 的所有网络地址

```sql
SELECT
  v.name,
  va.network,
  va.address,
  va.is_primary,
  va.label
FROM vendors v
JOIN vendor_addresses va ON v.id = va.vendor_id
WHERE v.owner_address = 'YOUR_ADDRESS'
ORDER BY v.name, va.is_primary DESC, va.network;
```

---

### 5.2 获取网络使用统计

```sql
SELECT
  network_type,
  chain,
  status,
  COUNT(*) as transaction_count,
  SUM(CAST(amount AS DECIMAL)) as total_amount,
  AVG(CAST(amount AS DECIMAL)) as avg_amount
FROM payments
WHERE created_by = 'YOUR_ADDRESS'
GROUP BY network_type, chain, status
ORDER BY total_amount DESC;
```

---

### 5.3 获取 TRON 交易详情

```sql
SELECT
  id,
  from_address,
  to_address,
  amount,
  token,
  tx_hash,
  energy_used,
  bandwidth_used,
  confirmations,
  status,
  created_at,
  completed_at
FROM payments
WHERE network_type = 'TRON'
  AND created_by = 'YOUR_ADDRESS'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 6. 前端集成示例

### 6.1 Vendor 地址管理 UI

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

function VendorAddressManager({ vendor }: { vendor: VendorWithAddresses }) {
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">网络地址</h3>
        <Button onClick={() => setShowAddForm(true)}>+ 添加地址</Button>
      </div>

      <div className="space-y-2">
        {vendor.addresses.map((addr) => (
          <div
            key={addr.id}
            className="flex items-center justify-between p-3 border rounded"
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={addr.networkType === "TRON" ? "secondary" : "default"}>
                  {addr.network.toUpperCase()}
                </Badge>
                {addr.isPrimary && <Badge variant="outline">主地址</Badge>}
                {addr.label && <span className="text-sm text-gray-600">{addr.label}</span>}
              </div>
              <p className="text-sm font-mono mt-1">{addr.address}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">编辑</Button>
              <Button variant="destructive" size="sm">删除</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 7. 最佳实践

### 7.1 地址验证
```typescript
// 始终验证地址
import { validateAddress } from "@/lib/address-utils"

const validation = validateAddress(inputAddress)
if (!validation.isValid) {
  return { error: validation.error }
}
```

### 7.2 网络检测
```typescript
// 自动检测网络类型
import { detectAddressType, getNetworkForAddress } from "@/lib/address-utils"

const addressType = detectAddressType(address)  // "EVM" | "TRON" | "INVALID"
const network = getNetworkForAddress(address)   // "ethereum" | "tron" | ...
```

### 7.3 错误处理
```typescript
try {
  await addVendorAddress(vendorId, userAddress, {
    network: "tron",
    address: tronAddress,
  })
} catch (error) {
  if (error.message.includes("already exists")) {
    // 地址已存在
  } else if (error.message.includes("Invalid address")) {
    // 地址无效
  }
}
```

---

## 8. 故障排查

### 8.1 地址未显示
- 检查 `vendor.addresses` 是否包含在查询中
- 确保使用了 `include: { addresses: true }`

### 8.2 网络类型错误
- 验证 TRON 地址以 "T" 开头且长度为 34
- EVM 地址以 "0x" 开头且长度为 42

### 8.3 主地址冲突
- 每个网络只能有一个主地址
- 设置新主地址会自动取消旧主地址

---

## 9. 相关文档

- [快速开始指南](./QUICK_START_TRON_INTEGRATION.md)
- [统一结算集成方案](./UNIFIED_SETTLEMENT_INTEGRATION_PLAN.md)
- [测试结果报告](./TEST_RESULTS.md)
