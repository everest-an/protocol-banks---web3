这份文档是为你量身定制的 **ProtocolBanks 产品功能规格说明书 (PRD)**。

它将你提供的 **5 层架构理论**（身份、授权、通信、支付、审计）完美落地为 **两类核心业务场景**（人类薪酬 SaaS \+ AI 代理计费）。

这份文档可以直接用于：

1. **内部开发**：指导 TypeScript 前端和 Go 后端开发。  
2. **对外融资**：展示给投资人，证明你有深厚的技术架构设计能力。

# ---

**ProtocolBanks 产品功能规格说明书 (PRD) v1.0**

**版本：** 1.0 (MVP)

**日期：** 2026-02-02

**定位：** 基于全链架构 (Omnichain) 的 Web3 企业薪酬与 AI 代理计费基础设施

## ---

**1\. 产品核心架构 (The 5-Layer Stack)**

我们将抽象的技术层级转化为 ProtocolBanks 的**五大核心组件模块**。这是产品的地基。

| 层级 | 内部命名 | 功能定义 | 对应技术实现 |
| :---- | :---- | :---- | :---- |
| **L1 身份层** | **PB-Link (身份通)** | 定义“谁在操作” (员工/AI Agent) | DID (去中心化身份)、钱包连接、KYC 状态绑定 |
| **L2 授权层** | **PB-Guard (卫士)** | 定义“额度与权限” | 账户抽象 (ERC-4337)、Session Keys (会话密钥)、多签策略 |
| **L3 通信层** | **PB-Stream (流通信)** | 定义“支付请求” | HTTP 402 协议扩展、发票标准化 (E-invoicing)、Webhook |
| **L4 支付层** | **PB-Rail (全链轨)** | 执行“资金结算” | ZetaChain 跨链互操作、Rain/Transak 法币通道 |
| **L5 审计层** | **PB-Proof (信证)** | 留存“合规证据” | 链上哈希存证、PDF 生成、ZKP 隐私凭证 |

## ---

**2\. 核心业务场景 A：企业薪酬 SaaS (Human Payroll)**

**目标客户：** Web3 初创公司、DAO、远程团队。

**价值主张：** 一键合规发放全球薪资，支持全链货币与法币自动分流。

### **2.1 功能模块：PB-Rail 批量支付引擎**

* **多链聚合支付 (Omnichain Payout)：**  
  * **输入：** 财务上传 Excel 表格（包含：员工地址、金额、目标币种）。  
  * **处理：** 系统自动计算汇率，财务只需支付一种代币（如 ETH）。  
  * **输出：** 员工 A 收到 BTC (原生)，员工 B 收到 SOL，员工 C 收到 USDT。  
  * *技术依赖：ZetaChain 跨链合约。*  
* **法币自动分流 (Fiat Off-ramp)：**  
  * **员工设置：** 员工可在后台设置“薪资 20% 自动兑换为法币入卡”。  
  * *技术依赖：Rain Global Payouts API。*

### **2.2 功能模块：PB-Guard 权限管理**

* **多签审批流：**  
  * 财务发起支付请求 $\\rightarrow$ CEO 手机收到通知 $\\rightarrow$ CEO 签名确认 $\\rightarrow$ 合约执行。  
* **白名单机制：**  
  * 限制只能向“已验证员工地址”转账，防止财务挪用资金。

### **2.3 功能模块：PB-Proof 合规报表**

* **自动化工资单 (Auto-Payslip)：**  
  * 支付成功后，系统生成 PDF 工资单，包含：企业信息、员工信息、Tx Hash、法币对标金额。  
* **邮件推送：** 自动发送至员工邮箱。

## ---

**3\. 核心业务场景 B：AI 代理计费 SDK (Agent Billing)**

**目标客户：** AI 服务商 (LLM, GPU)、DePIN 项目、开发者。

**价值主张：** 为 AI Agent 提供去中心化的“信用卡”，支持按量付费与微支付。

### **3.1 功能模块：PB-Link 代理身份**

* **Agent 注册：** 企业可为旗下的 AI 机器人创建“子账户”。  
* **身份验证：** API 服务商可通过 SDK 验证调用者是“来自 ProtocolBanks 认证的付费 Agent”。

### **3.2 功能模块：PB-Guard 会话密钥 (Session Keys)**

* **预授权订阅：**  
  * 企业授权 AI 账户：“允许该 Agent 在未来 30 天内，调用 Midjourney API，总限额 50 U”。  
  * **优势：** AI 调用 API 时无需人工签名，实现静默支付。  
* **AI 哨兵风控 (Sentinel)：**  
  * **熔断机制：** 监测到 AI 调用频率异常（如 1 秒调用 100 次）时，自动冻结权限。

### **3.3 功能模块：PB-Stream 微支付网关**

* **HTTP 402 响应：**  
  * 当 AI 请求资源时，网关拦截并返回 402 Payment Required。  
  * AI 钱包自动完成微小金额（如 0.01 U）的签名支付。  
* **流支付结算：**  
  * 基于状态通道，累积 10 次调用后统一上链结算一次，节省 Gas 费。

## ---

**4\. 用户交互流程 (User Journey)**

### **场景：CEO 发工资 (Human Flow)**

1. **登录：** CEO 连接钱包 (PB-Link)。  
2. **设置：** 导入员工 CSV，员工已预设好“收 BTC”或“收法币”。  
3. **充值：** CEO 向 ProtocolBanks 智能合约充值 50,000 USDT。  
4. **执行：** 点击“一键发放”。  
5. **结算 (PB-Rail)：**  
   * 后端 Go 引擎将 50,000 U 拆分。  
   * 调用 ZetaChain 换出 BTC 发给员工 A。  
   * 调用 Rain API 发法币给员工 B。  
6. **存证 (PB-Proof)：** 1 分钟后，所有员工收到 PDF 工资单邮件。

### **场景：AI 购买 API 服务 (Agent Flow)**

1. **授权：** 开发者在 ProtocolBanks 后台为 AI 生成一个 Session Key (PB-Guard)，限额 100 U。  
2. **调用：** AI 携带 Session Key 向服务商发起 HTTP 请求。  
3. **验证：** 服务商集成了 **PB-Stream SDK**，验证 Key 有效且余额充足。  
4. **扣费：** 服务商提供服务，计费引擎在后台扣除 0.01 U。  
5. **风控：** 如果 AI 发疯连续调用，PB-Guard 触发熔断，停止扣费。

## ---

**5\. 技术栈与开发规划 (Technical Implementation)**

### **前端 (TypeScript / Next.js)**

* **Dashboard：** 极简的企业管理后台。  
* **Widget SDK：** 封装好的“连接钱包”和“授权支付”组件，供 AI 公司嵌入官网。

### **后端 (Go / Golang)**

* **Payout Engine：** 核心资产调度引擎。处理高并发的批量转账队列、Nonce 管理、Gas 费优化。  
* **Billing Worker：** 监听链下 API 调用日志，定期触发链上结算合约。  
* **PDF Generator：** 基于链上数据生成合规凭证。

### **链上 (Solidity / ZetaChain)**

* **Factory Contract：** 为每个企业/Agent 部署 AA 智能账户。  
* **Router Contract：** 处理跨链 Swap 和分发逻辑。

## ---

**6\. MVP 开发路线图 (Roadmap for 3-Person Team)**

**阶段 1：生存期 (Month 1-2)**

* **目标：** 上线 **企业薪酬 SaaS**，跑通现金流。  
* **核心功能：** 批量支付 (PB-Rail)、多签 (PB-Guard)、PDF 工资单 (PB-Proof)。  
* **关键指标：** 处理 $100k+ 的薪资流水。

**阶段 2：拓展期 (Month 3-4)**

* **目标：** 上线 **AI 计费 SDK**，打出差异化。  
* **核心功能：** 会话密钥 (Session Keys)、微支付网关 (PB-Stream)。  
* **关键指标：** 接入 3-5 家 AI/DePIN 合作伙伴。

**阶段 3：生态期 (Month 5+)**

* **目标：** 完善 **L1-L5 全栈**。  
* **核心功能：** 引入 AI 风控模型 (Sentinel)、DID 身份系统。

---

这份文档通过将你之前提到的 **X402**、**Session Keys** 等技术概念包装进 **PB-Link/Guard/Stream** 等品牌模块中，既体现了技术深度，又让客户（无论是发工资的老板还是 AI 公司）能听懂你能解决什么问题。