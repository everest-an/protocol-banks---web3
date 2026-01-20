# Settlement Checkout - 完整 API 规范

## 📋 API 概览

Settlement Checkout 提供 20+ 个 API 端点，分为三个主要类别：
- **批量支付 API** (8 个端点)
- **x402 Gasless API** (5 个端点)
- **Off-Ramp API** (3 个端点)

---

## 🔐 认证

所有 API 请求都需要在 Header 中包含认证信息：

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### 获取 Access Token

```http
POST /api/auth/token
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

---

## 📤 批量支付 API

### 1. 上传文件

**端点**: `POST /api/batch-payment/upload`

**描述**: 上传 CSV 或 Excel 文件进行批量支付

**请求**:
```http
POST /api/batch-payment/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <binary>
```

**响应** (200 OK):
```json
{
  "success": true,
  "batchId": "batch_123abc",
  "recipients": [
    {
      "address": "0x1234567890123456789012345678901234567890",
      "amount": "100",
      "token": "USDC",
      "vendorName": "Vendor A",
      "vendorId": "V001"
    }
  ],
  "errors": [],
  "warnings": [
    "Row 5: Duplicate address detected"
  ],
  "summary": {
    "totalRows": 100,
    "validRows": 99,
    "invalidRows": 1
  }
}
```

**错误响应** (400 Bad Request):
```json
{
  "error": "Invalid file format",
  "details": "Only CSV and Excel files are supported"
}
```

---

### 2. 验证数据

**端点**: `POST /api/batch-payment/validate`

**描述**: 验证批量支付数据

**请求**:
```http
POST /api/batch-payment/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "batchId": "batch_123abc",
  "chainId": 1,
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "validItems": 99,
  "invalidItems": 1,
  "summary": {
    "totalAmount": "9900",
    "tokenBreakdown": {
      "USDC": "9900"
    },
    "estimatedGas": "6500000",
    "estimatedGasPrice": "50"
  },
  "issues": [
    {
      "rowIndex": 5,
      "address": "0x0000000000000000000000000000000000000000",
      "reason": "Invalid address (zero address)"
    }
  ]
}
```

---

### 3. 计算费用

**端点**: `POST /api/batch-payment/calculate-fees`

**描述**: 计算批量支付的费用

**请求**:
```http
POST /api/batch-payment/calculate-fees
Authorization: Bearer {token}
Content-Type: application/json

{
  "batchId": "batch_123abc",
  "chainId": 1,
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "totalAmount": "9900"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "breakdown": {
    "gasEstimate": "325",
    "gasPrice": "50",
    "totalGasCost": "16250",
    "serviceFee": "49.5",
    "totalFee": "16299.5"
  },
  "summary": {
    "totalAmount": "9900",
    "totalFee": "16299.5",
    "finalAmount": "9883.7"
  },
  "details": {
    "gasPerTransaction": "65000",
    "transactionCount": 5,
    "serviceFeePercentage": "0.5%",
    "gasMultiplier": "1.2"
  }
}
```

---

### 4. 提交支付

**端点**: `POST /api/batch-payment/submit`

**描述**: 提交批量支付

**请求**:
```http
POST /api/batch-payment/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  "batchId": "batch_123abc",
  "chainId": 1,
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "signature": "0x...",
  "pin": "123456"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "batchId": "batch_123abc",
  "status": "processing",
  "transactionHash": "0x...",
  "estimatedTime": "120",
  "message": "Batch payment submitted successfully"
}
```

---

### 5. 查询状态

**端点**: `GET /api/batch-payment/:batchId/status`

**描述**: 查询批量支付的状态

**请求**:
```http
GET /api/batch-payment/batch_123abc/status
Authorization: Bearer {token}
```

**响应** (200 OK):
```json
{
  "batchId": "batch_123abc",
  "status": "processing",
  "progress": {
    "total": 99,
    "completed": 45,
    "failed": 2,
    "pending": 52,
    "percentage": 45.45
  },
  "items": [
    {
      "index": 1,
      "address": "0x1234567890123456789012345678901234567890",
      "amount": "100",
      "status": "completed",
      "transactionHash": "0x...",
      "completedAt": "2026-01-21T10:30:00Z"
    }
  ],
  "summary": {
    "totalAmount": "9900",
    "completedAmount": "4500",
    "failedAmount": "200",
    "totalFee": "16299.5"
  }
}
```

---

### 6. 生成报告

**端点**: `GET /api/batch-payment/:batchId/report`

**描述**: 生成批量支付报告

**请求**:
```http
GET /api/batch-payment/batch_123abc/report?format=pdf
Authorization: Bearer {token}
```

**响应** (200 OK):
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="batch_123abc_report.pdf"

[PDF 内容]
```

---

### 7. 重试失败项

**端点**: `POST /api/batch-payment/:batchId/retry`

**描述**: 重试失败的支付项

**请求**:
```http
POST /api/batch-payment/batch_123abc/retry
Authorization: Bearer {token}
Content-Type: application/json

{
  "itemIndices": [2, 5, 8],
  "signature": "0x...",
  "pin": "123456"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "retriedCount": 3,
  "newTransactionHash": "0x...",
  "message": "Retry submitted successfully"
}
```

---

### 8. 历史记录

**端点**: `GET /api/batch-payment/history`

**描述**: 获取批量支付历史记录

**请求**:
```http
GET /api/batch-payment/history?page=1&limit=10&status=completed
Authorization: Bearer {token}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "batchId": "batch_123abc",
      "batchName": "Payroll 2026-01",
      "status": "completed",
      "totalAmount": "9900",
      "totalFee": "16299.5",
      "itemCount": 99,
      "successfulCount": 97,
      "failedCount": 2,
      "createdAt": "2026-01-21T10:00:00Z",
      "completedAt": "2026-01-21T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

## 🔐 x402 Gasless API

### 1. 生成授权

**端点**: `POST /api/x402/generate-authorization`

**描述**: 生成 EIP-712 授权

**请求**:
```http
POST /api/x402/generate-authorization
Authorization: Bearer {token}
Content-Type: application/json

{
  "to": "0x1234567890123456789012345678901234567890",
  "amount": "100",
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chainId": 1,
  "validFor": 3600
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "authorizationId": "auth_123abc",
  "domain": {
    "name": "ProtocolBanks",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  },
  "types": {
    "TransferWithAuthorization": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" }
    ]
  },
  "message": {
    "from": "0x...",
    "to": "0x1234567890123456789012345678901234567890",
    "value": "100000000",
    "validAfter": 1705829400,
    "validBefore": 1705833000,
    "nonce": "0x..."
  }
}
```

---

### 2. 提交签名

**端点**: `POST /api/x402/submit-signature`

**描述**: 提交用户签名

**请求**:
```http
POST /api/x402/submit-signature
Authorization: Bearer {token}
Content-Type: application/json

{
  "authorizationId": "auth_123abc",
  "signature": "0x..."
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "authorizationId": "auth_123abc",
  "status": "signed",
  "message": "Signature submitted successfully"
}
```

---

### 3. 提交到 Relayer

**端点**: `POST /api/x402/submit-to-relayer`

**描述**: 提交授权到 Relayer

**请求**:
```http
POST /api/x402/submit-to-relayer
Authorization: Bearer {token}
Content-Type: application/json

{
  "authorizationId": "auth_123abc"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "authorizationId": "auth_123abc",
  "status": "submitted",
  "transactionHash": "0x...",
  "relayerAddress": "0x...",
  "relayerFee": "0.5",
  "message": "Submitted to Relayer successfully"
}
```

---

### 4. 查询状态

**端点**: `GET /api/x402/:authorizationId/status`

**描述**: 查询授权状态

**请求**:
```http
GET /api/x402/auth_123abc/status
Authorization: Bearer {token}
```

**响应** (200 OK):
```json
{
  "authorizationId": "auth_123abc",
  "status": "executed",
  "from": "0x...",
  "to": "0x1234567890123456789012345678901234567890",
  "amount": "100",
  "token": "USDC",
  "nonce": "0x...",
  "transactionHash": "0x...",
  "relayerFee": "0.5",
  "actualAmount": "99.5",
  "createdAt": "2026-01-21T10:00:00Z",
  "executedAt": "2026-01-21T10:05:00Z"
}
```

---

### 5. 取消授权

**端点**: `POST /api/x402/:authorizationId/cancel`

**描述**: 取消授权

**请求**:
```http
POST /api/x402/auth_123abc/cancel
Authorization: Bearer {token}
Content-Type: application/json

{}
```

**响应** (200 OK):
```json
{
  "success": true,
  "authorizationId": "auth_123abc",
  "status": "cancelled",
  "message": "Authorization cancelled successfully"
}
```

---

## 💰 Off-Ramp API

### 1. 获取报价

**端点**: `POST /api/offramp/quote`

**描述**: 获取法币转换报价

**请求**:
```http
POST /api/offramp/quote
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": "1000",
  "inputToken": "USDC",
  "outputCurrency": "USD",
  "chainId": 1,
  "provider": "coinbase"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "quoteId": "quote_123abc",
  "inputAmount": "1000",
  "inputToken": "USDC",
  "outputAmount": "990",
  "outputCurrency": "USD",
  "exchangeRate": "0.99",
  "fee": "10",
  "feePercentage": "1%",
  "provider": "coinbase",
  "expiresAt": "2026-01-21T10:15:00Z",
  "estimatedTime": "1-3 days"
}
```

---

### 2. 发起转换

**端点**: `POST /api/offramp/initiate`

**描述**: 发起法币转换

**请求**:
```http
POST /api/offramp/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "quoteId": "quote_123abc",
  "walletAddress": "0x...",
  "bankAccount": {
    "type": "ach",
    "accountNumber": "123456789",
    "routingNumber": "021000021",
    "accountHolderName": "John Doe"
  }
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "transactionId": "offramp_123abc",
  "status": "pending",
  "redirectUrl": "https://provider.example.com/checkout?session=...",
  "message": "Redirect to provider to complete KYC"
}
```

---

### 3. 查询状态

**端点**: `GET /api/offramp/:transactionId/status`

**描述**: 查询 Off-Ramp 交易状态

**请求**:
```http
GET /api/offramp/offramp_123abc/status
Authorization: Bearer {token}
```

**响应** (200 OK):
```json
{
  "transactionId": "offramp_123abc",
  "status": "completed",
  "inputAmount": "1000",
  "inputToken": "USDC",
  "outputAmount": "990",
  "outputCurrency": "USD",
  "provider": "coinbase",
  "bankReference": "BANK-REF-123",
  "transactionHash": "0x...",
  "createdAt": "2026-01-21T10:00:00Z",
  "completedAt": "2026-01-23T14:30:00Z"
}
```

---

## 🔄 Webhook 事件

### 批量支付事件

```json
{
  "event": "batch_payment.completed",
  "batchId": "batch_123abc",
  "status": "completed",
  "timestamp": "2026-01-21T10:30:00Z",
  "data": {
    "totalAmount": "9900",
    "successfulCount": 97,
    "failedCount": 2
  }
}
```

### x402 事件

```json
{
  "event": "x402_authorization.executed",
  "authorizationId": "auth_123abc",
  "status": "executed",
  "timestamp": "2026-01-21T10:05:00Z",
  "data": {
    "transactionHash": "0x...",
    "amount": "100",
    "relayerFee": "0.5"
  }
}
```

### Off-Ramp 事件

```json
{
  "event": "offramp_transaction.completed",
  "transactionId": "offramp_123abc",
  "status": "completed",
  "timestamp": "2026-01-23T14:30:00Z",
  "data": {
    "outputAmount": "990",
    "bankReference": "BANK-REF-123"
  }
}
```

---

## ❌ 错误响应

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Missing required field: amount",
  "code": "INVALID_REQUEST"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "code": "UNAUTHORIZED"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource",
  "code": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Batch payment not found",
  "code": "NOT_FOUND"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "code": "INTERNAL_ERROR"
}
```

---

## 📊 速率限制

| 端点类型 | 限制 | 时间窗口 |
|---------|------|--------|
| 上传文件 | 10 | 1 小时 |
| 验证数据 | 100 | 1 小时 |
| 计算费用 | 100 | 1 小时 |
| 提交支付 | 50 | 1 小时 |
| 查询状态 | 1000 | 1 小时 |
| 生成报告 | 20 | 1 小时 |

---

## 🔐 安全建议

1. **使用 HTTPS** - 所有请求必须使用 HTTPS
2. **验证签名** - 验证 Webhook 签名
3. **存储 Token** - 安全存储 Access Token
4. **刷新 Token** - 定期刷新 Token
5. **IP 白名单** - 配置 IP 白名单
6. **API 密钥轮换** - 定期轮换 API 密钥

---

**最后更新**: 2026-01-21  
**版本**: 1.0  
**API 版本**: v1
