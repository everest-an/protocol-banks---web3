# 需求文档

## 简介

本规范定义了 MSafe 多签钱包集成功能，用于为商户提供安全的稳定币收单托管服务。参考 AWS 支付网关架构、阿里支付宝和腾讯微信支付的企业级设计模式，构建高可用、高安全、可扩展的托管收单系统。

MSafe 是基于 Aptos 区块链的多签钱包解决方案，通过 Move 模块和原生 multi-ed25519 多签机制实现资产的安全托管。

## 系统架构

### 整体架构图

\`\`\`mermaid
graph TB
    subgraph 接入层
        A[API Gateway] --> B[负载均衡]
        B --> C[限流/熔断]
    end
    
    subgraph 业务服务层
        C --> D[支付网关服务]
        C --> E[托管管理服务]
        C --> F[对账清算服务]
        D --> G[路由引擎]
        E --> H[多签编排服务]
        F --> I[账务核心]
    end
    
    subgraph 基础设施层
        G --> J[消息队列]
        H --> J
        I --> J
        J --> K[事件处理器]
        K --> L[Webhook 服务]
    end
    
    subgraph 数据层
        D --> M[(主数据库)]
        E --> M
        F --> M
        M --> N[(只读副本)]
        D --> O[(Redis 缓存)]
    end
    
    subgraph 区块链层
        G --> P[MSafe SDK]
        P --> Q[Aptos 区块链]
        Q --> R[MSafe 多签钱包]
    end
    
    subgraph 监控告警
        S[Prometheus] --> T[Grafana]
        U[日志收集] --> V[ELK Stack]
        W[链路追踪] --> X[Jaeger]
    end
\`\`\`

### 支付收单流程

\`\`\`mermaid
sequenceDiagram
    participant C as 客户
    participant GW as 支付网关
    participant RT as 路由引擎
    participant MQ as 消息队列
    participant CS as 托管服务
    participant MS as MSafe SDK
    participant BC as Aptos 区块链
    participant WH as Webhook
    participant M as 商户
    
    C->>GW: 1. 发起支付请求
    GW->>GW: 2. 参数校验 + 幂等检查
    GW->>RT: 3. 路由决策
    RT->>RT: 4. 查询商户托管配置
    RT->>MS: 5. 获取托管钱包地址
    MS-->>RT: 6. 返回 MSafe 地址
    RT-->>GW: 7. 返回支付参数
    GW-->>C: 8. 返回支付信息
    
    C->>BC: 9. 链上转账
    BC-->>CS: 10. 交易确认事件
    CS->>CS: 11. 验证交易
    CS->>MQ: 12. 发布支付成功事件
    MQ->>WH: 13. 触发 Webhook
    WH->>M: 14. 通知商户
\`\`\`

## 术语表

| 术语 | 定义 |
|------|------|
| **MSafe_Wallet** | MSafe 多签钱包，基于 Aptos 区块链的多签资产管理解决方案 |
| **Custody_Account** | 托管账户，用于安全存储商户收单的稳定币资产 |
| **Threshold** | 多签阈值，执行交易所需的最小签名数量 |
| **Signer** | 签名者，有权对多签交易进行签名的地址 |
| **Stablecoin** | 稳定币，如 USDC、USDT 等与法币挂钩的加密货币 |
| **Escrow_Transaction** | 托管交易，将收单资金转入托管账户的交易 |
| **Withdrawal_Proposal** | 提款提案，从托管账户提取资金的多签请求 |
| **Settlement** | 结算，将托管资金转移到商户指定地址的过程 |
| **Idempotency_Key** | 幂等键，用于防止重复处理的唯一标识 |
| **Circuit_Breaker** | 熔断器，用于防止级联故障的保护机制 |

## 需求

### 需求 1: MSafe 钱包创建与配置

**用户故事:** 作为商户，我希望创建一个 MSafe 托管钱包，以便安全地接收和持有客户支付的稳定币。

\`\`\`mermaid
sequenceDiagram
    participant M as 商户
    participant API as API Gateway
    participant SVC as 托管服务
    participant VAL as 验证器
    participant SDK as MSafe SDK
    participant BC as Aptos 区块链
    participant DB as 数据库
    participant MQ as 消息队列
    
    M->>API: 请求创建托管钱包
    API->>API: 身份认证 + 限流检查
    API->>SVC: 转发请求
    SVC->>VAL: 验证参数
    VAL->>VAL: 检查签名者数量 >= 2
    VAL->>VAL: 检查阈值 >= 2
    VAL-->>SVC: 验证通过
    
    SVC->>SDK: 调用创建多签钱包
    SDK->>BC: 部署多签合约
    BC-->>SDK: 返回钱包地址
    SDK-->>SVC: 返回钱包信息
    
    SVC->>DB: 存储钱包配置
    SVC->>MQ: 发布钱包创建事件
    SVC-->>API: 返回托管账户 ID
    API-->>M: 返回成功响应
\`\`\`

#### 验收标准

1. WHEN 商户发起托管钱包创建时, THE MSafe_Integration_Service SHALL 连接 MSafe SDK 并在 Aptos 上创建新的多签钱包
2. WHEN 创建托管钱包时, THE System SHALL 要求商户指定至少 2 个签名者和至少 2 的阈值
3. WHEN 托管钱包创建成功时, THE System SHALL 将钱包地址、签名者和阈值存储到数据库
4. IF MSafe SDK 连接失败, THEN THE System SHALL 返回描述性错误并最多重试 3 次（指数退避）
5. WHEN 托管钱包成功创建时, THE System SHALL 生成唯一的托管账户 ID 并返回给商户
6. THE System SHALL 记录钱包创建操作到审计日志

### 需求 2: 稳定币收单路由

**用户故事:** 作为商户，我希望客户支付自动路由到我的托管钱包，以便资金在收到后立即得到保护。

\`\`\`mermaid
flowchart TD
    A[收到支付请求] --> B{幂等检查}
    B -->|已处理| C[返回缓存结果]
    B -->|新请求| D[生成幂等键]
    D --> E{商户有托管钱包?}
    E -->|是| F[获取 MSafe 地址]
    E -->|否| G[使用商户默认地址]
    F --> H[构建支付参数]
    G --> H
    H --> I[缓存支付会话]
    I --> J[返回支付信息]
    
    K[链上交易确认] --> L{验证交易}
    L -->|有效| M[更新支付状态]
    L -->|无效| N[标记异常]
    M --> O[发布支付事件]
    O --> P[触发 Webhook]
    N --> Q[人工审核队列]
\`\`\`

#### 验收标准

1. WHEN 客户发起稳定币支付时, THE Payment_Router SHALL 首先进行幂等性检查，防止重复处理
2. WHEN 配置了托管钱包时, THE Payment_Router SHALL 将支付直接路由到 MSafe 托管地址
3. WHEN 支付被路由到托管时, THE System SHALL 记录托管交易，包含支付 ID、金额、代币类型、时间戳和幂等键
4. IF 支付路由失败, THEN THE System SHALL 将支付加入重试队列，使用指数退避策略
5. WHEN 支付成功托管时, THE System SHALL 通过消息队列异步发送 Webhook 通知
6. THE System SHALL 支持配置多个 RPC 端点，实现故障自动切换

### 需求 3: 托管余额查询

**用户故事:** 作为商户，我希望查看我的托管钱包余额，以便实时监控我的托管资金。

\`\`\`mermaid
flowchart LR
    A[余额查询请求] --> B{缓存命中?}
    B -->|是| C{缓存过期?}
    C -->|否| D[返回缓存余额]
    C -->|是| E[标记为过期数据]
    E --> D
    B -->|否| F[查询链上余额]
    F --> G{查询成功?}
    G -->|是| H[更新缓存]
    H --> I[返回最新余额]
    G -->|否| J{有历史缓存?}
    J -->|是| K[返回过期余额+告警]
    J -->|否| L[返回错误]
\`\`\`

#### 验收标准

1. WHEN 商户请求托管余额时, THE Balance_Service SHALL 优先从缓存获取，缓存未命中时查询 Aptos 区块链
2. THE Balance_Service SHALL 返回所有支持的稳定币余额（USDC、USDT 等）
3. WHEN 显示余额时, THE System SHALL 同时显示链上余额和待入账支付
4. THE System SHALL 缓存余额查询 30 秒，并支持配置缓存时间
5. IF 余额查询失败, THEN THE System SHALL 返回最后缓存的余额并标记为过期数据

### 需求 4: 提款提案创建

**用户故事:** 作为商户签名者，我希望创建提款提案，以便启动从托管中转移资金的流程。

\`\`\`mermaid
stateDiagram-v2
    [*] --> 待审批: 创建提案
    待审批 --> 待审批: 收到批准 (未达阈值)
    待审批 --> 待执行: 批准数达到阈值
    待审批 --> 已拒绝: 拒绝数超过限制
    待审批 --> 已过期: 超过有效期
    待执行 --> 执行中: 提交交易
    执行中 --> 已完成: 交易确认
    执行中 --> 失败: 交易失败
    失败 --> 待执行: 重试 (次数未超限)
    失败 --> 已终止: 重试次数超限
    已拒绝 --> [*]
    已过期 --> [*]
    已完成 --> [*]
    已终止 --> [*]
\`\`\`

#### 验收标准

1. WHEN 签名者创建提款提案时, THE Proposal_Service SHALL 验证签名者是否被授权访问该托管钱包
2. WHEN 创建提案时, THE System SHALL 要求提供目标地址、金额、代币类型和提案有效期
3. THE System SHALL 验证提款金额不超过可用托管余额
4. WHEN 提案创建成功时, THE System SHALL 以"待审批"状态存储并通过消息队列通知所有其他签名者
5. IF 提案创建验证失败, THEN THE System SHALL 返回每个验证失败的具体错误信息
6. THE System SHALL 为每个提案生成唯一的提案 ID 和 nonce 值

### 需求 5: 多签审批流程

**用户故事:** 作为托管钱包签名者，我希望批准或拒绝提款提案，以便资金只能在适当授权下转移。

\`\`\`mermaid
sequenceDiagram
    participant S1 as 签名者 1
    participant S2 as 签名者 2
    participant S3 as 签名者 3
    participant API as API Gateway
    participant SVC as 审批服务
    participant SDK as MSafe SDK
    participant DB as 数据库
    participant MQ as 消息队列
    participant N as 通知服务
    
    S1->>API: 创建提款提案
    API->>SVC: 转发请求
    SVC->>DB: 存储提案
    SVC->>MQ: 发布提案创建事件
    MQ->>N: 触发通知
    N->>S2: 推送审批通知
    N->>S3: 推送审批通知
    
    S2->>API: 批准提案 (签名)
    API->>SVC: 转发批准
    SVC->>SDK: 验证签名
    SDK-->>SVC: 签名有效
    SVC->>DB: 记录批准 (1/2)
    SVC->>MQ: 发布批准事件
    
    S3->>API: 批准提案 (签名)
    API->>SVC: 转发批准
    SVC->>SDK: 验证签名
    SDK-->>SVC: 签名有效
    SVC->>DB: 记录批准 (2/2)
    SVC->>SVC: 检测达到阈值
    SVC->>DB: 更新状态为"待执行"
    SVC->>MQ: 发布阈值达成事件
\`\`\`

#### 验收标准

1. WHEN 签名者批准提案时, THE Approval_Service SHALL 使用 MSafe SDK 验证签名者的签名
2. WHEN 签名者批准时, THE System SHALL 记录批准信息，包含签名者地址、签名、时间戳和 IP 地址
3. WHEN 批准数达到阈值时, THE System SHALL 将提案状态更新为"待执行"
4. WHEN 签名者拒绝提案时, THE System SHALL 记录拒绝并通知提案创建者
5. IF 提案收到超过 (总签名者数 - 阈值) 个拒绝, THEN THE System SHALL 将提案标记为"已拒绝"
6. THE System SHALL 防止同一签名者重复批准或拒绝同一提案

### 需求 6: 提款执行

**用户故事:** 作为商户，我希望已批准的提款自动执行，以便资金无需人工干预即可转移。

\`\`\`mermaid
flowchart TD
    A[提案达到阈值] --> B[加入执行队列]
    B --> C{检查提款延迟}
    C -->|未到时间| D[等待延迟期]
    D --> C
    C -->|已到时间| E[收集签名]
    E --> F[组装 multi-ed25519 签名]
    F --> G[提交到 MSafe]
    G --> H{提交成功?}
    H -->|是| I[监控交易状态]
    H -->|否| J{重试次数 < 5?}
    J -->|是| K[指数退避等待]
    K --> G
    J -->|否| L[标记失败 + 告警]
    I --> M{交易确认?}
    M -->|是| N[更新状态为已完成]
    M -->|超时| O[查询交易状态]
    O --> M
    N --> P[发布执行完成事件]
    P --> Q[触发 Webhook]
\`\`\`

#### 验收标准

1. WHEN 提案达到"待执行"状态时, THE Execution_Service SHALL 检查提款延迟配置后提交交易
2. THE Execution_Service SHALL 收集所有批准签名并组装成 multi-ed25519 签名
3. WHEN 交易提交后, THE System SHALL 在 Aptos 区块链上监控交易状态
4. WHEN 交易确认后, THE System SHALL 将提案状态更新为"已完成"并记录交易哈希
5. IF 交易失败, THEN THE System SHALL 使用指数退避策略重试，最多 5 次
6. THE System SHALL 在执行完成后通过 Webhook 通知商户

### 需求 7: 审计日志与对账

**用户故事:** 作为合规官员，我希望所有托管操作都被记录，以便审计资金流动和进行对账。

\`\`\`mermaid
erDiagram
    AUDIT_LOG {
        uuid id PK
        string event_type
        string actor_address
        string target_type
        uuid target_id
        json details
        string ip_address
        string user_agent
        string session_id
        timestamp created_at
        string trace_id
    }
    
    RECONCILIATION_RECORD {
        uuid id PK
        date reconciliation_date
        uuid custody_wallet_id FK
        decimal chain_balance
        decimal system_balance
        decimal difference
        string status
        json discrepancies
        timestamp created_at
    }
    
    CUSTODY_WALLET ||--o{ AUDIT_LOG : generates
    CUSTODY_WALLET ||--o{ RECONCILIATION_RECORD : reconciles
    ESCROW_TRANSACTION ||--o{ AUDIT_LOG : generates
    WITHDRAWAL_PROPOSAL ||--o{ AUDIT_LOG : generates
\`\`\`

#### 验收标准

1. THE Audit_Service SHALL 记录所有托管钱包创建事件，包含创建者地址、配置和链路追踪 ID
2. THE Audit_Service SHALL 记录所有托管交易，包含支付详情、时间戳和关联的业务订单
3. THE Audit_Service SHALL 记录所有提案创建、批准、拒绝和执行操作
4. WHEN 记录事件时, THE System SHALL 包含 IP 地址、用户代理、会话 ID 和链路追踪 ID
5. THE System SHALL 使审计日志不可变 - 不允许更新或删除
6. THE System SHALL 每日自动执行对账，比较链上余额与系统记录

### 需求 8: 安全配置与风控

**用户故事:** 作为商户，我希望为我的托管钱包配置安全设置，以便自定义资金的保护级别。

\`\`\`mermaid
graph TD
    subgraph 安全配置
        A[提款延迟] --> A1[默认 24 小时]
        A --> A2[可配置 0-72 小时]
        
        B[提款限额] --> B1[单笔限额]
        B --> B2[每日限额]
        B --> B3[每周限额]
        
        C[签名者管理] --> C1[添加签名者]
        C --> C2[移除签名者]
        C --> C3[更换签名者]
        
        D[阈值调整] --> D1[需要多签提案]
        D --> D2[需要所有签名者同意]
    end
    
    subgraph 风控规则
        E[地址白名单] --> E1[仅允许提款到白名单地址]
        F[异常检测] --> F1[大额交易告警]
        F --> F2[频繁交易告警]
        G[熔断机制] --> G1[异常时暂停提款]
    end
\`\`\`

#### 验收标准

1. THE System SHALL 允许商户设置最小提款延迟（默认 24 小时，范围 0-72 小时）
2. THE System SHALL 允许商户配置单笔、每日和每周提款限额
3. WHEN 提款超过配置限额时, THE System SHALL 要求额外的批准或人工审核
4. THE System SHALL 支持通过多签提案流程添加或移除签名者
5. THE System SHALL 支持通过多签提案流程更改阈值（需要所有现有签名者同意）
6. THE System SHALL 支持配置提款地址白名单

### 需求 9: 高可用与容错

**用户故事:** 作为系统管理员，我希望系统具备高可用性和容错能力，以便托管服务持续稳定运行。

\`\`\`mermaid
flowchart TD
    subgraph 请求处理
        A[API 请求] --> B{熔断器状态}
        B -->|关闭| C[正常处理]
        B -->|打开| D[快速失败]
        B -->|半开| E[限流处理]
        C --> F{处理成功?}
        F -->|是| G[返回成功]
        F -->|否| H[记录失败]
        H --> I{失败率 > 阈值?}
        I -->|是| J[打开熔断器]
        I -->|否| K[继续监控]
    end
    
    subgraph RPC 故障转移
        L[主 RPC] --> M{连接正常?}
        M -->|是| N[使用主 RPC]
        M -->|否| O[切换备用 RPC]
        O --> P{备用可用?}
        P -->|是| Q[使用备用 RPC]
        P -->|否| R[加入重试队列]
    end
    
    subgraph 消息可靠性
        S[业务事件] --> T[写入消息队列]
        T --> U{写入成功?}
        U -->|是| V[确认处理]
        U -->|否| W[本地持久化]
        W --> X[定时重试]
    end
\`\`\`

#### 验收标准

1. IF Aptos RPC 连接失败, THEN THE System SHALL 自动故障转移到备用 RPC 端点
2. IF 交易提交失败, THEN THE System SHALL 实现指数退避重试，最多 5 次尝试
3. WHEN 发生严重错误时, THE System SHALL 通过多渠道（邮件、短信、钉钉）发送告警
4. THE System SHALL 实现熔断器模式，防止级联故障
5. THE System SHALL 维护待处理操作的持久化队列，确保消息不丢失
6. WHEN 系统从故障中恢复时, THE System SHALL 按顺序处理排队的交易

### 需求 10: 数据序列化与存储

**用户故事:** 作为开发者，我希望托管数据被正确序列化和存储，以便可以可靠地检索和处理。

\`\`\`mermaid
graph LR
    subgraph 数据流
        A[业务对象] --> B[JSON 序列化]
        B --> C[数据验证]
        C --> D{验证通过?}
        D -->|是| E[写入数据库]
        D -->|否| F[返回验证错误]
        E --> G[写入成功]
        G --> H[更新缓存]
    end
    
    subgraph 数据恢复
        I[读取数据库] --> J[JSON 反序列化]
        J --> K[对象重建]
        K --> L{对象有效?}
        L -->|是| M[返回对象]
        L -->|否| N[数据修复流程]
    end
\`\`\`

#### 验收标准

1. WHEN 存储托管钱包数据时, THE System SHALL 使用 JSON 格式序列化
2. WHEN 存储交易提案时, THE System SHALL 以可恢复格式包含所有签名数据
3. FOR ALL 有效的托管钱包对象, 序列化然后反序列化 SHALL 产生等价对象（往返属性）
4. THE System SHALL 在存储前根据 JSON Schema 验证所有数据
5. IF 数据验证失败, THEN THE System SHALL 拒绝操作并返回具体的验证错误
6. THE System SHALL 支持数据版本控制，便于未来的数据迁移

## 非功能性需求

### 性能要求

| 指标 | 目标值 |
|------|--------|
| API 响应时间 (P99) | < 500ms |
| 支付路由延迟 | < 200ms |
| 余额查询延迟 | < 100ms (缓存命中) |
| 系统可用性 | 99.9% |
| 并发支付处理能力 | 1000 TPS |

### 安全要求

- 所有 API 通信使用 TLS 1.3
- 敏感数据加密存储（AES-256）
- 支持 API Key + 签名双重认证
- 实现请求限流和防重放攻击
- 定期安全审计和渗透测试
