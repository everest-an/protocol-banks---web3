# Protocol Banks iOS - API集成指南

## 概述

本指南说明如何集成Protocol Banks后端API与iOS应用。应用使用RESTful API进行数据交互，所有通信均通过HTTPS进行。

## API基础配置

### 端点配置
在 `Services/APIClient.swift` 中配置:
```swift
private let baseURL = "https://api.protocolbanks.com"
```

### 认证方式
使用Bearer Token认证:
```swift
private func addAuthHeaders(_ request: inout URLRequest) {
    if let token = StorageManager.shared.loadAuthToken() {
        request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
    }
}
```

### 请求/响应格式
- **请求**: JSON格式，Content-Type: application/json
- **响应**: JSON格式，包含data和error字段

## API端点列表

### 用户管理 (/users)

#### 获取用户信息
```swift
GET /users/me
Response: User
```

#### 更新用户信息
```swift
PUT /users/me
Body: { name, email, ... }
Response: User
```

#### 创建用户
```swift
POST /users
Body: { walletAddress, name, ... }
Response: User
```

### 交易管理 (/transactions)

#### 获取交易列表
```swift
GET /transactions?walletAddress=0x...&limit=50&offset=0
Response: [Transaction]
```

#### 获取交易详情
```swift
GET /transactions/:hash
Response: Transaction
```

#### 提交交易
```swift
POST /transactions
Body: {
    from, to, amount, token, chain, 
    gasPrice, gasLimit, data
}
Response: { transactionHash, status }
```

### 实体管理 (/entities)

#### 获取实体列表
```swift
GET /entities?walletAddress=0x...
Response: [Entity]
```

#### 创建实体
```swift
POST /entities
Body: { name, address, category }
Response: Entity
```

#### 更新实体
```swift
PUT /entities/:id
Body: { name, category, ... }
Response: Entity
```

#### 删除实体
```swift
DELETE /entities/:id
Response: { success: true }
```

### 支付链接 (/payment-links)

#### 创建支付链接
```swift
POST /payment-links
Body: {
    recipient, amount, token, 
    expiresIn, metadata
}
Response: PaymentLink
```

#### 验证支付链接
```swift
GET /payment-links/:id/verify
Response: { valid: true, ... }
```

#### 获取支付链接详情
```swift
GET /payment-links/:id
Response: PaymentLink
```

### 批量支付 (/batch-payments)

#### 提交批量支付
```swift
POST /batch-payments
Body: {
    fromAddress, recipients, chain, 
    token, metadata
}
Response: BatchPayment
```

#### 获取批量支付列表
```swift
GET /batch-payments?walletAddress=0x...
Response: [BatchPayment]
```

#### 获取批量支付详情
```swift
GET /batch-payments/:id
Response: BatchPayment
```

### 分析 (/analytics)

#### 获取财务指标
```swift
GET /analytics/metrics?walletAddress=0x...
Response: FinancialMetrics
```

#### 获取支付趋势
```swift
GET /analytics/trends?walletAddress=0x...&days=30
Response: [PaymentTrend]
```

#### 获取网络图数据
```swift
GET /analytics/network?walletAddress=0x...
Response: NetworkGraphData
```

## 实现示例

### 获取交易历史
```swift
// ViewModel中
func loadTransactions() {
    guard let wallet = walletManager.currentWallet else { return }
    
    isLoading = true
    
    Task {
        do {
            let transactions = try await apiClient.fetchTransactions(
                walletAddress: wallet.address,
                limit: 50
            )
            
            await MainActor.run {
                self.transactions = transactions
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }
}
```

### 提交批量支付
```swift
// ViewModel中
func submitBatchPayment() {
    let batchPayment = BatchPayment(
        id: UUID().uuidString,
        fromAddress: wallet.address,
        recipients: recipients,
        chain: selectedChain.rawValue,
        createdAt: Date(),
        status: .pending,
        transactionHash: nil
    )
    
    Task {
        do {
            let result = try await apiClient.submitBatchPayment(batchPayment)
            
            await MainActor.run {
                self.successMessage = "Payment submitted"
                self.resetForm()
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}
```

### 创建支付链接
```swift
// ViewModel中
func generatePaymentLink() {
    Task {
        do {
            let link = try await apiClient.createPaymentLink(
                recipient: recipientAddress,
                amount: Decimal(string: amount) ?? 0,
                token: selectedToken
            )
            
            await MainActor.run {
                self.generatedLink = link
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}
```

## 错误处理

### API错误响应格式
```json
{
    "error": {
        "code": "INVALID_REQUEST",
        "message": "Invalid recipient address",
        "details": {}
    }
}
```

### 错误处理示例
```swift
enum APIError: LocalizedError {
    case invalidResponse
    case decodingError
    case networkError(Error)
    case serverError(code: String, message: String)
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid API response"
        case .decodingError:
            return "Failed to decode response"
        case .networkError(let error):
            return error.localizedDescription
        case .serverError(_, let message):
            return message
        }
    }
}

// 使用
do {
    let data = try await apiClient.fetchData()
} catch let error as APIError {
    print("API Error: \\(error.errorDescription ?? "Unknown")")
} catch {
    print("Error: \\(error)")
}
```

## 认证流程

### 登录
```swift
// 1. 连接钱包
let wallet = try await walletManager.connectWallet()

// 2. 签名消息
let signature = try await walletManager.signMessage("Login message")

// 3. 获取Token
let token = try await apiClient.authenticate(
    walletAddress: wallet.address,
    signature: signature
)

// 4. 保存Token
StorageManager.shared.saveAuthToken(token)
```

### Token刷新
```swift
// 当Token过期时自动刷新
private func refreshToken() async throws -> String {
    let newToken = try await apiClient.refreshToken()
    StorageManager.shared.saveAuthToken(newToken)
    return newToken
}
```

## 数据同步

### 离线支持
```swift
// 保存本地副本
StorageManager.shared.saveTransactions(transactions)

// 离线时使用本地数据
let cachedTransactions = StorageManager.shared.loadTransactions()

// 网络恢复时同步
Task {
    do {
        let freshData = try await apiClient.fetchTransactions(...)
        StorageManager.shared.saveTransactions(freshData)
    } catch {
        // 使用缓存数据
    }
}
```

### 实时更新
```swift
// 使用WebSocket进行实时更新 (可选)
class WebSocketManager {
    func connectToUpdates() {
        // 建立WebSocket连接
        // 订阅交易更新
        // 自动更新UI
    }
}
```

## 性能优化

### 请求缓存
```swift
// 缓存GET请求
let config = URLSessionConfiguration.default
config.requestCachePolicy = .returnCacheDataElseLoad
config.urlCache = URLCache(
    memoryCapacity: 10_000_000,
    diskCapacity: 100_000_000
)
```

### 批量请求
```swift
// 并发请求
async let transactions = apiClient.fetchTransactions(...)
async let entities = apiClient.fetchEntities(...)
let (txns, ents) = try await (transactions, entities)
```

### 分页加载
```swift
// 实现分页
func loadMoreTransactions() {
    offset += limit
    Task {
        let more = try await apiClient.fetchTransactions(
            limit: limit,
            offset: offset
        )
        transactions.append(contentsOf: more)
    }
}
```

## 测试API集成

### 使用Postman测试
1. 导入API集合
2. 配置环境变量 (baseURL, token)
3. 测试各个端点

### 单元测试
```swift
func testFetchTransactions() {
    let expectation = XCTestExpectation(description: "Fetch transactions")
    
    Task {
        do {
            let transactions = try await apiClient.fetchTransactions(
                walletAddress: "0x123",
                limit: 10
            )
            XCTAssertGreaterThan(transactions.count, 0)
            expectation.fulfill()
        } catch {
            XCTFail("Failed to fetch: \\(error)")
        }
    }
    
    wait(for: [expectation], timeout: 5.0)
}
```

## 常见问题

**Q: 如何处理API超时?**
A: 设置合理的超时时间，实现重试机制。

**Q: 如何处理速率限制?**
A: 实现请求队列，遵守API速率限制。

**Q: 如何调试API请求?**
A: 使用Charles/Fiddler拦截，或在APIClient中添加日志。

**Q: 如何处理Token过期?**
A: 实现Token刷新机制，自动重试失败的请求。

## 参考资源

- [RESTful API最佳实践](https://restfulapi.net/)
- [URLSession文档](https://developer.apple.com/documentation/foundation/urlsession)
- [Combine文档](https://developer.apple.com/documentation/combine)
- [Protocol Banks API文档](https://api.protocolbanks.com/docs)

---

**最后更新**: 2025年12月9日
