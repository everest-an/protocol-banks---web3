# 百分比分账功能 - API 设计文档

## 1. API 概览

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/split-payment` | POST | 创建分账任务 | 钱包地址 |
| `/api/split-payment` | GET | 获取分账历史 | 钱包地址 |
| `/api/split-payment/[id]` | GET | 获取单个分账详情 | 钱包地址 |
| `/api/split-payment/[id]` | DELETE | 取消待执行分账 | 钱包地址 |
| `/api/split-payment/calculate` | POST | 计算分账金额 | 无 |
| `/api/split-payment/execute` | POST | 执行分账支付 | 钱包地址 |
| `/api/split-templates` | GET | 获取模板列表 | 钱包地址 |
| `/api/split-templates` | POST | 创建模板 | 钱包地址 |
| `/api/split-templates/[id]` | PUT | 更新模板 | 钱包地址 |
| `/api/split-templates/[id]` | DELETE | 删除模板 | 钱包地址 |

---

## 2. 通用定义

### 2.1 错误响应格式

```typescript
interface ApiError {
  error: string;           // 错误消息
  code?: string;           // 错误代码
  details?: string[];      // 详细错误列表
  field?: string;          // 相关字段
}
```

### 2.2 分页参数

```typescript
interface PaginationParams {
  limit?: number;   // 每页数量，默认 20，最大 100
  offset?: number;  // 偏移量，默认 0
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
```

### 2.3 HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 3. 分账 API

### 3.1 计算分账金额

预览计算结果，不保存到数据库。

**请求**
```http
POST /api/split-payment/calculate
Content-Type: application/json
```

**请求体**
```json
{
  "rule": {
    "mode": "percentage",
    "totalAmount": 10000,
    "token": "USDC",
    "chainId": 8453,
    "items": [
      {
        "id": "1",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
        "name": "Alice",
        "percentage": 40
      },
      {
        "id": "2",
        "address": "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
        "name": "Bob",
        "percentage": 35
      },
      {
        "id": "3",
        "address": "0x1234567890123456789012345678901234567890",
        "name": "Charlie",
        "percentage": 25
      }
    ]
  }
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "calculation": {
    "success": true,
    "items": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
        "name": "Alice",
        "percentage": 40,
        "amount": 4000
      },
      {
        "address": "0x8B3392483BA26D65E331dB86D4F430E9B3814E5e",
        "name": "Bob",
        "percentage": 35,
        "amount": 3500
      },
      {
        "address": "0x1234567890123456789012345678901234567890",
        "name": "Charlie",
        "percentage": 25,
        "amount": 2500
      }
    ],
    "totalAmount": 10000,
    "remainderAddress": "0x1234567890123456789012345678901234567890"
  }
}
```

**失败响应 (400)**
```json
{
  "success": false,
  "errors": [
    "百分比总和必须为 100%，当前: 95%"
  ]
}
```

---

### 3.2 创建分账任务

**请求**
```http
POST /api/split-payment
Content-Type: application/json
```

**请求体**
```json
{
  "creatorAddress": "0x123...",
  "rule": {
    "mode": "percentage",
    "totalAmount": 10000,
    "token": "USDC",
    "chainId": 8453,
    "items": [
      {
        "id": "1",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f7DCFF",
        "name": "Alice",
        "percentage": 40
      }
    ]
  },
  "templateId": "uuid-optional",
  "executeImmediately": false
}
```

**成功响应 (201)**
```json
{
  "success": true,
  "splitPayment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "creatorAddress": "0x123...",
    "totalAmount": "10000",
    "token": "USDC",
    "chainId": 8453,
    "splitMode": "percentage",
    "rule": { ... },
    "calculation": { ... },
    "status": "pending",
    "createdAt": "2025-01-30T10:00:00Z"
  }
}
```

---

### 3.3 获取分账历史

**请求**
```http
GET /api/split-payment?creatorAddress=0x123...&limit=20&offset=0&status=completed
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| creatorAddress | string | 是 | 钱包地址 |
| limit | number | 否 | 每页数量，默认 20 |
| offset | number | 否 | 偏移量，默认 0 |
| status | string | 否 | 筛选状态 |
| startDate | string | 否 | 开始日期 (ISO 8601) |
| endDate | string | 否 | 结束日期 (ISO 8601) |

**成功响应 (200)**
```json
{
  "splitPayments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "totalAmount": "10000",
      "token": "USDC",
      "splitMode": "percentage",
      "status": "completed",
      "recipientCount": 3,
      "createdAt": "2025-01-30T10:00:00Z",
      "executedAt": "2025-01-30T10:05:00Z"
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

---

### 3.4 获取分账详情

**请求**
```http
GET /api/split-payment/550e8400-e29b-41d4-a716-446655440000
```

**成功响应 (200)**
```json
{
  "splitPayment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "creatorAddress": "0x123...",
    "totalAmount": "10000",
    "token": "USDC",
    "chainId": 8453,
    "splitMode": "percentage",
    "rule": {
      "mode": "percentage",
      "totalAmount": 10000,
      "token": "USDC",
      "chainId": 8453,
      "items": [...]
    },
    "calculation": {
      "success": true,
      "items": [...],
      "totalAmount": 10000
    },
    "status": "completed",
    "results": [
      {
        "success": true,
        "recipient": "0x742d...",
        "amount": 4000,
        "token": "USDC",
        "txHash": "0xabc..."
      }
    ],
    "createdAt": "2025-01-30T10:00:00Z",
    "executedAt": "2025-01-30T10:05:00Z"
  }
}
```

---

### 3.5 执行分账

**请求**
```http
POST /api/split-payment/execute
Content-Type: application/json
```

**请求体**
```json
{
  "splitPaymentId": "550e8400-e29b-41d4-a716-446655440000",
  "wallet": "0x123..."
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "splitPayment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "results": [
      {
        "success": true,
        "recipient": "0x742d...",
        "amount": 4000,
        "txHash": "0xabc..."
      },
      {
        "success": true,
        "recipient": "0x8B33...",
        "amount": 3500,
        "txHash": "0xdef..."
      },
      {
        "success": true,
        "recipient": "0x1234...",
        "amount": 2500,
        "txHash": "0xghi..."
      }
    ],
    "executedAt": "2025-01-30T10:05:00Z"
  }
}
```

**部分失败响应 (200)**
```json
{
  "success": false,
  "splitPayment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "partial",
    "results": [
      {
        "success": true,
        "recipient": "0x742d...",
        "amount": 4000,
        "txHash": "0xabc..."
      },
      {
        "success": false,
        "recipient": "0x8B33...",
        "amount": 3500,
        "error": "Transaction reverted"
      }
    ],
    "executedAt": "2025-01-30T10:05:00Z"
  },
  "failedCount": 1,
  "successCount": 2
}
```

---

### 3.6 取消分账

只能取消状态为 `pending` 的分账。

**请求**
```http
DELETE /api/split-payment/550e8400-e29b-41d4-a716-446655440000
```

**请求体**
```json
{
  "creatorAddress": "0x123..."
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "message": "Split payment cancelled"
}
```

---

## 4. 模板 API

### 4.1 获取模板列表

**请求**
```http
GET /api/split-templates?ownerAddress=0x123...
```

**成功响应 (200)**
```json
{
  "templates": [
    {
      "id": "template-uuid-1",
      "name": "合伙人分成",
      "description": "三人合伙按 40/35/25 分成",
      "recipientCount": 3,
      "usageCount": 15,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-28T10:00:00Z"
    },
    {
      "id": "template-uuid-2",
      "name": "月度 KOL",
      "description": "KOL 推广费分配",
      "recipientCount": 8,
      "usageCount": 3,
      "createdAt": "2025-01-20T10:00:00Z",
      "updatedAt": "2025-01-20T10:00:00Z"
    }
  ],
  "total": 2
}
```

---

### 4.2 创建模板

**请求**
```http
POST /api/split-templates
Content-Type: application/json
```

**请求体**
```json
{
  "ownerAddress": "0x123...",
  "name": "合伙人分成",
  "description": "三人合伙按 40/35/25 分成",
  "rule": {
    "mode": "percentage",
    "token": "USDC",
    "chainId": 8453,
    "items": [
      {
        "id": "1",
        "address": "0x742d...",
        "name": "Alice",
        "percentage": 40
      },
      {
        "id": "2",
        "address": "0x8B33...",
        "name": "Bob",
        "percentage": 35
      },
      {
        "id": "3",
        "address": "0x1234...",
        "name": "Charlie",
        "percentage": 25
      }
    ]
  }
}
```

**成功响应 (201)**
```json
{
  "success": true,
  "template": {
    "id": "template-uuid-new",
    "name": "合伙人分成",
    "description": "三人合伙按 40/35/25 分成",
    "rule": { ... },
    "usageCount": 0,
    "createdAt": "2025-01-30T10:00:00Z"
  }
}
```

**失败响应 (400)**
```json
{
  "error": "Template name already exists",
  "code": "DUPLICATE_NAME"
}
```

---

### 4.3 获取模板详情

**请求**
```http
GET /api/split-templates/template-uuid-1
```

**成功响应 (200)**
```json
{
  "template": {
    "id": "template-uuid-1",
    "ownerAddress": "0x123...",
    "name": "合伙人分成",
    "description": "三人合伙按 40/35/25 分成",
    "rule": {
      "mode": "percentage",
      "token": "USDC",
      "chainId": 8453,
      "items": [
        {
          "id": "1",
          "address": "0x742d...",
          "name": "Alice",
          "percentage": 40
        }
      ]
    },
    "usageCount": 15,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-28T10:00:00Z"
  }
}
```

---

### 4.4 更新模板

**请求**
```http
PUT /api/split-templates/template-uuid-1
Content-Type: application/json
```

**请求体**
```json
{
  "ownerAddress": "0x123...",
  "name": "合伙人分成（更新）",
  "description": "四人合伙",
  "rule": {
    "mode": "percentage",
    "token": "USDC",
    "chainId": 8453,
    "items": [
      {
        "id": "1",
        "address": "0x742d...",
        "name": "Alice",
        "percentage": 30
      },
      {
        "id": "4",
        "address": "0xnew...",
        "name": "David",
        "percentage": 10
      }
    ]
  }
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "template": { ... }
}
```

---

### 4.5 删除模板

**请求**
```http
DELETE /api/split-templates/template-uuid-1
```

**请求体**
```json
{
  "ownerAddress": "0x123..."
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "message": "Template deleted"
}
```

---

## 5. 错误代码

| 代码 | 说明 |
|------|------|
| INVALID_ADDRESS | 无效的钱包地址 |
| INVALID_AMOUNT | 无效的金额 |
| INVALID_PERCENTAGE | 无效的百分比 |
| PERCENTAGE_SUM_ERROR | 百分比总和不等于 100% |
| TOO_MANY_RECIPIENTS | 收款人数量超过限制 |
| DUPLICATE_NAME | 模板名称重复 |
| NOT_FOUND | 资源不存在 |
| ALREADY_EXECUTED | 分账已执行，不能修改 |
| UNAUTHORIZED | 无权操作此资源 |
| INSUFFICIENT_BALANCE | 余额不足 |
| EXECUTION_FAILED | 执行失败 |

---

## 6. 限流策略

| 端点 | 限制 |
|------|------|
| /api/split-payment/calculate | 60 次/分钟 |
| /api/split-payment (POST) | 30 次/分钟 |
| /api/split-payment/execute | 10 次/分钟 |
| /api/split-templates | 60 次/分钟 |

---

## 7. Webhook 事件

分账执行完成后，触发以下 webhook 事件：

```json
{
  "event": "split_payment.completed",
  "data": {
    "split_payment_id": "550e8400-e29b-41d4-a716-446655440000",
    "creator_address": "0x123...",
    "total_amount": "10000",
    "token": "USDC",
    "status": "completed",
    "recipient_count": 3,
    "success_count": 3,
    "failed_count": 0,
    "executed_at": "2025-01-30T10:05:00Z"
  },
  "timestamp": "2025-01-30T10:05:01Z"
}
```

---

**最后更新**: 2025-01-30
