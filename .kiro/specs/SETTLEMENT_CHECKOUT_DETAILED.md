# Settlement Checkout - 详细技术架构与流程图

## 📊 系统组件交互图

```mermaid
graph TB
    subgraph Frontend["前端层 (Next.js)"]
        UI1["支付接收页面"]
        UI2["批量支付页面"]
        UI3["法币转换页面"]
    end
    
    subgraph API["API 层 (Next.js Routes)"]
        API1["POST /batch-payment/upload"]
        API2["POST /batch-payment/validate"]
        API3["POST /batch-payment/calculate-fees"]
        API4["POST /batch-payment/submit"]
        API5["POST /x402/generate-authorization"]
        API6["POST /offramp/quote"]
    end
    
    subgraph Services["业务逻辑层 (Services)"]
        SVC1["File Parser"]
        SVC2["Batch Validator"]
        SVC3["Fee Calculator"]
        SVC4["EIP712 Service"]
        SVC5["Nonce Manager"]
        SVC6["Relayer Client"]
    end
    
    subgraph GoEngine["Go 微服务层"]
        GO1["Payout Engine<br/>500+ TPS"]
        GO2["Event Indexer"]
        GO3["Webhook Handler"]
    end
    
    subgraph Database["数据层 (Supabase)"]
        DB1["batch_payments"]
        DB2["payment_items"]
        DB3["x402_authorizations"]
        DB4["x402_nonces"]
        DB5["offramp_transactions"]
    end
    
    subgraph Blockchain["区块链层"]
        BC1["Ethereum"]
        BC2["Polygon"]
        BC3["Arbitrum"]
        BC4["Base"]
    end
    
    UI1 --> API1
    UI2 --> API2
    UI3 --> API6
    
    API1 --> SVC1
    API2 --> SVC2
    API3 --> SVC3
    API4 --> SVC4
    API5 --> SVC5
    API6 --> SVC6
    
    SVC1 --> DB1
    SVC2 --> DB2
    SVC3 --> DB1
    SVC4 --> DB3
    SVC5 --> DB4
    SVC6 --> GO1
    
    GO1 --> BC1
    GO1 --> BC2
    GO1 --> BC3
    GO1 --> BC4
    
    GO2 --> DB1
    GO2 --> DB2
    GO3 --> DB5
```

## 🔄 批量支付完整流程图

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant API as API 层
    participant Services as 业务逻辑
    participant GoEngine as Go 引擎
    participant Blockchain as 区块链
    participant DB as 数据库
    
    User->>Frontend: 1. 上传 CSV 文件
    Frontend->>API: POST /batch-payment/upload
    API->>Services: 调用 File Parser
    Services->>DB: 保存原始数据
    Services-->>API: 返回解析结果
    API-->>Frontend: 显示预览
    
    User->>Frontend: 2. 确认数据
    Frontend->>API: POST /batch-payment/validate
    API->>Services: 调用 Batch Validator
    Services->>Services: 地址验证、ENS 解析
    Services->>DB: 保存验证结果
    Services-->>API: 返回验证报告
    API-->>Frontend: 显示验证结果
    
    User->>Frontend: 3. 查看费用
    Frontend->>API: POST /batch-payment/calculate-fees
    API->>Services: 调用 Fee Calculator
    Services->>Services: 估算 Gas、计算服务费
    Services-->>API: 返回费用明细
    API-->>Frontend: 显示费用
    
    User->>Frontend: 4. 确认支付
    Frontend->>API: POST /batch-payment/submit
    API->>Services: 调用 EIP712 Service
    Services->>Services: 生成签名、验证 PIN
    Services->>DB: 更新状态为 processing
    Services->>GoEngine: 提交批量支付
    
    GoEngine->>GoEngine: 并发处理 (500+ TPS)
    GoEngine->>GoEngine: Nonce 管理、自动重试
    GoEngine->>Blockchain: 提交交易
    Blockchain-->>GoEngine: 返回 txHash
    
    GoEngine->>DB: 更新交易状态
    GoEngine->>Frontend: WebSocket 实时更新
    Frontend-->>User: 显示进度
    
    GoEngine->>DB: 标记为 completed
    GoEngine-->>Frontend: 发送完成通知
    Frontend-->>User: 显示成功
```

## 🔐 x402 Gasless 支付流程图

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant API as API 层
    participant Services as 业务逻辑
    participant Relayer as Relayer
    participant Blockchain as 区块链
    participant DB as 数据库
    
    User->>Frontend: 1. 发起 Gasless 支付
    Frontend->>API: POST /x402/generate-authorization
    API->>Services: 调用 EIP712 Service
    Services->>Services: 创建域分隔符
    Services->>Services: 构建消息结构
    Services->>DB: 获取当前 Nonce
    Services-->>API: 返回授权数据
    API-->>Frontend: 显示签名请求
    
    User->>Frontend: 2. 签署授权
    Frontend->>Frontend: 使用钱包签署
    Frontend->>API: POST /x402/submit-signature
    API->>Services: 验证签名
    Services->>Services: 恢复签署者地址
    Services->>DB: 检查 Nonce 未使用
    Services->>DB: 存储授权
    Services-->>API: 返回授权 ID
    API-->>Frontend: 显示成功
    
    Frontend->>API: POST /x402/submit-to-relayer
    API->>Services: 调用 Relayer Client
    Services->>Relayer: 提交授权
    Relayer->>Relayer: 验证签名
    Relayer->>Relayer: 估算 Gas 成本
    Relayer->>Relayer: 检查盈利性
    Relayer->>Blockchain: 提交交易
    Blockchain-->>Relayer: 返回 txHash
    
    Relayer->>DB: 更新授权状态
    Relayer-->>Frontend: 发送完成通知
    Frontend-->>User: 显示成功
    
    DB->>DB: 标记 Nonce 已使用
```

## 💰 Off-Ramp 法币转换流程图

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant API as API 层
    participant OffRamp as Off-Ramp 服务
    participant Provider as 第三方提供商
    participant Bank as 银行
    
    User->>Frontend: 1. 选择法币转换
    Frontend->>API: POST /offramp/quote
    API->>OffRamp: 获取报价
    OffRamp->>Provider: 查询汇率
    Provider-->>OffRamp: 返回报价
    OffRamp-->>API: 返回报价信息
    API-->>Frontend: 显示报价
    
    User->>Frontend: 2. 确认转换
    Frontend->>API: POST /offramp/initiate
    API->>OffRamp: 发起转换
    OffRamp->>Provider: 提交转换请求
    Provider-->>OffRamp: 返回重定向 URL
    OffRamp-->>API: 返回重定向 URL
    API-->>Frontend: 重定向到提供商
    
    Frontend->>Provider: 用户完成 KYC
    Provider->>Provider: 验证身份
    Provider->>Bank: 发起银行转账
    Bank-->>Provider: 确认转账
    Provider->>API: Webhook 通知完成
    API-->>Frontend: 显示完成
    Frontend-->>User: 资金已到账
```

## 📊 数据流图

```mermaid
graph LR
    subgraph Input["输入"]
        CSV["CSV/Excel 文件"]
        Wallet["钱包地址"]
        Amount["转账金额"]
    end
    
    subgraph Processing["处理"]
        Parse["文件解析"]
        Validate["数据验证"]
        Calculate["费用计算"]
        Sign["交易签名"]
        Execute["链上执行"]
    end
    
    subgraph Output["输出"]
        TxHash["交易哈希"]
        Status["交易状态"]
        Report["完整报告"]
    end
    
    CSV --> Parse
    Wallet --> Validate
    Amount --> Calculate
    
    Parse --> Validate
    Validate --> Calculate
    Calculate --> Sign
    Sign --> Execute
    
    Execute --> TxHash
    Execute --> Status
    Execute --> Report
```

## 🔐 安全性流程图

```mermaid
graph TD
    subgraph KeyManagement["私钥管理"]
        PIN["用户 PIN"]
        PBKDF2["PBKDF2<br/>100,000 iterations"]
        AES["AES-256-GCM<br/>加密"]
        Shamir["Shamir 2-of-3<br/>分片"]
    end
    
    subgraph SigningProcess["签名过程"]
        Confirm["用户确认"]
        InputPIN["输入 PIN"]
        Reconstruct["重建私钥<br/>Share A + Share B"]
        Sign["签署交易"]
        Destroy["销毁私钥<br/>内存清零"]
    end
    
    subgraph ReplayProtection["防重放保护"]
        Nonce["唯一 Nonce"]
        Increment["Nonce 递增"]
        Store["存储已使用"]
        Verify["链上验证"]
    end
    
    PIN --> PBKDF2
    PBKDF2 --> AES
    AES --> Shamir
    
    Confirm --> InputPIN
    InputPIN --> Reconstruct
    Reconstruct --> Sign
    Sign --> Destroy
    
    Nonce --> Increment
    Increment --> Store
    Store --> Verify
```

## 🚀 性能优化架构

```mermaid
graph TB
    subgraph Optimization["性能优化"]
        Batch["批量处理<br/>1000+ 行"]
        Parallel["并行验证<br/>10 个 worker"]
        BulkDB["批量数据库<br/>插入"]
        Concurrent["并发执行<br/>500+ TPS"]
        Cache["多层缓存<br/>1h/5m/24h"]
    end
    
    subgraph GasOptimization["Gas 优化"]
        Group["交易分组<br/>按代币"]
        Approve["批量 Approve<br/>一次性"]
        Transfer["批量转账<br/>一个交易"]
        Nonce["Nonce 预分配"]
        Dynamic["Gas 价格<br/>动态调整"]
    end
    
    Batch --> Parallel
    Parallel --> BulkDB
    BulkDB --> Concurrent
    Concurrent --> Cache
    
    Group --> Approve
    Approve --> Transfer
    Transfer --> Nonce
    Nonce --> Dynamic
```

## 🔗 多链架构

```mermaid
graph TB
    subgraph L1["Layer 1"]
        ETH["Ethereum<br/>chainId: 1"]
        BSC["BSC<br/>chainId: 56"]
    end
    
    subgraph L2["Layer 2"]
        POLY["Polygon<br/>chainId: 137"]
        ARB["Arbitrum<br/>chainId: 42161"]
        OPT["Optimism<br/>chainId: 10"]
        BASE["Base<br/>chainId: 8453"]
    end
    
    subgraph Router["路由层"]
        SELECT["用户选择链"]
        ROUTE["获取最佳路由"]
        SWAP["执行 Swap/Bridge"]
        MONITOR["监听事件"]
    end
    
    SELECT --> ROUTE
    ROUTE --> ETH
    ROUTE --> BSC
    ROUTE --> POLY
    ROUTE --> ARB
    ROUTE --> OPT
    ROUTE --> BASE
    
    ETH --> SWAP
    BSC --> SWAP
    POLY --> SWAP
    ARB --> SWAP
    OPT --> SWAP
    BASE --> SWAP
    
    SWAP --> MONITOR
```

## 📈 实时监控架构

```mermaid
graph LR
    subgraph Metrics["Prometheus 指标"]
        M1["支付成功率"]
        M2["平均处理时间"]
        M3["Gas 成本"]
        M4["错误率"]
        M5["Relayer 性能"]
    end
    
    subgraph Dashboard["Grafana 仪表板"]
        D1["交易吞吐量"]
        D2["费用分析"]
        D3["用户活跃度"]
        D4["系统健康状态"]
    end
    
    subgraph Alerts["告警系统"]
        A1["高错误率"]
        A2["性能下降"]
        A3["异常交易"]
    end
    
    M1 --> D1
    M2 --> D2
    M3 --> D2
    M4 --> A1
    M5 --> A2
    
    D1 --> A3
    D3 --> A3
```

## 🗄️ 数据库关系图

```mermaid
erDiagram
    BATCH_PAYMENTS ||--o{ PAYMENT_ITEMS : contains
    BATCH_PAYMENTS ||--o{ X402_AUTHORIZATIONS : has
    X402_AUTHORIZATIONS ||--o{ X402_NONCES : uses
    X402_AUTHORIZATIONS ||--o{ X402_USED_NONCES : marks
    OFFRAMP_TRANSACTIONS ||--o{ BATCH_PAYMENTS : references
    
    BATCH_PAYMENTS {
        UUID id
        UUID user_id
        VARCHAR batch_name
        VARCHAR status
        DECIMAL total_amount
        DECIMAL total_fee
        INT item_count
        TIMESTAMP created_at
    }
    
    PAYMENT_ITEMS {
        UUID id
        UUID batch_id
        VARCHAR recipient_address
        DECIMAL amount
        VARCHAR token_symbol
        VARCHAR status
        VARCHAR transaction_hash
        TIMESTAMP completed_at
    }
    
    X402_AUTHORIZATIONS {
        UUID id
        UUID user_id
        VARCHAR token_address
        INT chain_id
        VARCHAR from_address
        VARCHAR to_address
        DECIMAL amount
        INT nonce
        VARCHAR signature
        VARCHAR status
        VARCHAR transaction_hash
        TIMESTAMP created_at
    }
    
    X402_NONCES {
        UUID id
        UUID user_id
        VARCHAR token_address
        INT chain_id
        INT current_nonce
        TIMESTAMP updated_at
    }
    
    X402_USED_NONCES {
        UUID id
        UUID user_id
        VARCHAR token_address
        INT chain_id
        INT nonce
        TIMESTAMP used_at
    }
    
    OFFRAMP_TRANSACTIONS {
        VARCHAR id
        VARCHAR wallet_address
        VARCHAR provider
        DECIMAL input_amount
        VARCHAR input_token
        DECIMAL output_amount
        VARCHAR output_currency
        VARCHAR status
        VARCHAR tx_hash
        TIMESTAMP created_at
    }
```

## 🎯 API 调用流程总结

```mermaid
graph TD
    subgraph BatchPayment["批量支付 API"]
        BP1["POST /upload"]
        BP2["POST /validate"]
        BP3["POST /calculate-fees"]
        BP4["POST /submit"]
        BP5["GET /:batchId/status"]
        BP6["GET /:batchId/report"]
    end
    
    subgraph X402["x402 Gasless API"]
        X1["POST /generate-authorization"]
        X2["POST /submit-signature"]
        X3["POST /submit-to-relayer"]
        X4["GET /:authId/status"]
    end
    
    subgraph OffRamp["Off-Ramp API"]
        O1["POST /quote"]
        O2["POST /initiate"]
    end
    
    BP1 --> BP2
    BP2 --> BP3
    BP3 --> BP4
    BP4 --> BP5
    BP5 --> BP6
    
    X1 --> X2
    X2 --> X3
    X3 --> X4
    
    O1 --> O2
```

---

## 📚 关键指标

| 指标 | 值 |
|------|-----|
| 吞吐量 | 500+ TPS |
| 平均延迟 | <3 秒 |
| 支付成功率 | >99.5% |
| Gas 优化 | 30-40% 节省 |
| 支持链数 | 6+ |
| 支持代币 | 100+ |
| 最大批量大小 | 10,000 项 |
| 费用 | 0.5% + Gas |

---

## 🔗 相关文件参考

- **前端**: `app/batch-payment/page.tsx`, `app/x402/page.tsx`, `app/offramp/page.tsx`
- **API**: `app/api/batch-payment/`, `app/api/x402/`, `app/api/offramp/`
- **服务**: `services/file-parser.service.ts`, `services/batch-validator.service.ts`, `services/fee-calculator.service.ts`, `services/eip712.service.ts`, `services/nonce-manager.service.ts`, `services/relayer-client.service.ts`
- **数据库**: `migrations/`
- **配置**: `lib/offramp.ts`
