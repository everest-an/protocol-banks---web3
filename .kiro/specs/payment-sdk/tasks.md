# Implementation Plan: ProtocolBanks Payment SDK

## Overview

本实现计划将 SDK 设计转化为可执行的开发任务。优先实现 TypeScript SDK 和嵌入式收款组件，让商户可以快速在网站上部署加密货币收款功能。支持多种加密货币（USDC、USDT、DAI、ETH、BTC、SOL）和多条区块链。

## Tasks

- [x] 1. 项目初始化与基础设施
  - [x] 1.1 创建 TypeScript SDK 项目结构
    - 初始化 npm 包 `@protocolbanks/sdk`
    - 配置 TypeScript、ESLint、Prettier
    - 配置 Jest 测试框架和 fast-check 属性测试
    - 配置 Rollup 打包 (CommonJS + ESM + UMD)
    - _Requirements: 15.1, 15.4_

  - [x] 1.2 实现核心类型定义
    - 创建 `src/types/index.ts` 包含所有接口定义
    - ChainId, ChainConfig, TokenConfig
    - PaymentLinkParams, PaymentLink, QROptions
    - CheckoutConfig, CheckoutTheme, CheckoutResult
    - X402Authorization, BatchRecipient, WebhookEvent
    - SDKError, RetryConfig
    - _Requirements: 2.1, 3.1, 15.1_

  - [x] 1.3 实现多链配置
    - 创建 `src/config/chains.ts` 链配置
    - 支持 Ethereum, Polygon, Base, Arbitrum, Optimism, BSC
    - 支持 Solana, Bitcoin
    - 配置每条链支持的代币
    - _Requirements: 2.1-2.7, 3.1-3.10_

  - [x] 1.4 实现 HTTP 客户端基础
    - 创建 `src/utils/http.ts` HTTP 客户端封装
    - 实现请求/响应拦截器
    - 实现自动重试逻辑 (指数退避)
    - 实现速率限制处理
    - _Requirements: 14.2, 14.4, 16.2_

  - [x] 1.5 实现错误处理系统
    - 创建 `src/utils/errors.ts` 错误类定义
    - 实现错误码格式 (PB_XXX_NNN)
    - 实现错误本地化 (英文/中文)
    - _Requirements: 14.1, 14.3, 14.5_

  - [ ]* 1.6 编写错误码格式属性测试
    - **Property 13: Error Code Format Consistency**
    - **Validates: Requirements 14.1**

- [x] 2. Checkpoint - 基础设施验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 3. 支付链接模块实现
  - [x] 3.1 实现签名工具
    - 创建 `src/utils/crypto.ts`
    - 实现 HMAC-SHA256 签名生成
    - 实现签名验证 (常量时间比较)
    - _Requirements: 4.5, 8.1_

  - [x] 3.2 实现地址验证
    - 创建 `src/utils/validation.ts`
    - 实现以太坊地址格式验证 (0x + 40 hex)
    - 实现 Solana 地址验证 (Base58)
    - 实现 Bitcoin 地址验证
    - 实现同形字符检测 (Cyrillic)
    - 实现金额范围验证
    - _Requirements: 4.2, 4.3, 8.4_

  - [x]* 3.3 编写地址验证属性测试
    - **Property 2: Payment Link Parameter Validation**
    - **Property 6: Homoglyph Attack Detection**
    - **Validates: Requirements 4.2, 8.4**

  - [x] 3.4 实现 PaymentLinkModule
    - 创建 `src/modules/links.ts`
    - 实现 `generate()` 方法 (支持多链)
    - 实现 `verify()` 方法
    - 实现 `parse()` 方法
    - 实现 `getSupportedChains()` 和 `getSupportedTokens()`
    - _Requirements: 4.1, 4.4, 4.6, 4.7, 4.8, 8.2, 8.3, 8.5_

  - [ ]* 3.5 编写支付链接属性测试
    - **Property 1: Payment Link Round-Trip Verification**
    - **Property 4: Expiry Time Calculation**
    - **Property 5: Tamper Detection**
    - **Property 7: Expired Link Detection**
    - **Validates: Requirements 4.1, 4.4, 4.5, 8.1, 8.2, 8.3, 8.5**

- [ ] 4. QR 码模块实现
  - [x] 4.1 实现 QR 码生成
    - 创建 `src/modules/qr.ts`
    - 集成 qrcode 库
    - 实现 SVG/PNG/Base64 输出
    - 实现 Logo 嵌入功能
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x]* 4.2 编写 QR 码单元测试
    - 测试不同尺寸输出
    - 测试不同格式输出
    - 测试 Logo 嵌入
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Checkpoint - 支付链接模块验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 6. 嵌入式收款组件实现 (核心功能)
  - [x] 6.1 创建 React 组件库项目
    - 初始化 `@protocolbanks/react` 包
    - 配置 Storybook 组件文档
    - 配置 CSS-in-JS (styled-components 或 emotion)
    - _Requirements: 6.1, 6.9, 15.6_

  - [x] 6.2 实现 CheckoutProvider
    - 创建 `src/context/CheckoutContext.tsx`
    - 管理 API 配置和认证状态
    - 提供 Context 给子组件
    - _Requirements: 6.1_

  - [x] 6.3 实现 Checkout Widget
    - 创建 `src/components/CheckoutWidget.tsx`
    - 实现链选择器 (ChainSelector)
    - 实现代币选择器 (TokenSelector)
    - 实现钱包连接 (MetaMask, WalletConnect, Phantom)
    - 实现支付表单和确认
    - 实现支付状态显示
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.4 实现 Payment Button
    - 创建 `src/components/PaymentButton.tsx`
    - 实现多种样式 (default, minimal, branded, outline)
    - 实现点击打开 Checkout Modal
    - 实现支付状态显示
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.5 实现主题定制
    - 创建 `src/theme/index.ts`
    - 支持颜色、字体、圆角定制
    - 支持 Logo 和公司名称
    - 支持 Dark Mode
    - _Requirements: 6.5_

  - [x] 6.6 实现响应式设计
    - 移动端适配 (CSS media queries)
    - 触摸友好的交互
    - _Requirements: 6.6_

  - [x]* 6.7 编写组件单元测试
    - 测试 CheckoutWidget 渲染
    - 测试 PaymentButton 交互
    - 测试主题定制
    - _Requirements: 6.1-6.9_

- [ ] 7. 嵌入式脚本实现
  - [x] 7.1 实现 Vanilla JS 版本
    - 创建 `src/embed/checkout.js`
    - 支持 data-* 属性配置
    - 自动初始化组件
    - _Requirements: 6.8, 7.6_

  - [x] 7.2 实现 HTML 代码片段生成
    - 创建代码生成器
    - 支持复制粘贴集成
    - _Requirements: 7.6, 13.3_

  - [x] 7.3 实现托管结账页面
    - 创建 `/checkout/:sessionId` 页面
    - 支持无代码集成
    - _Requirements: 13.1, 13.2_

- [x] 8. Checkpoint - 嵌入式组件验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 9. x402 Gasless 模块实现
  - [x] 9.1 实现 EIP-712 类型数据生成
    - 创建 `src/modules/x402.ts`
    - 实现 domain 和 types 结构
    - 实现 TransferWithAuthorization 消息构建
    - 实现 nonce 生成 (随机 32 字节)
    - _Requirements: 11.1, 11.6_

  - [x] 9.2 实现授权生命周期管理
    - 实现 `createAuthorization()` 方法
    - 实现 `submitSignature()` 方法
    - 实现 `getStatus()` 方法
    - 实现 `cancel()` 方法
    - 实现过期检测 (1 小时)
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ]* 9.3 编写 x402 属性测试
    - **Property 8: x402 Authorization Lifecycle**
    - **Property 9: x402 Nonce Uniqueness**
    - **Property 10: x402 Expiry Enforcement**
    - **Validates: Requirements 11.4, 11.5, 11.6**

- [ ] 10. 批量支付模块实现
  - [x] 10.1 实现批量验证
    - 创建 `src/modules/batch.ts`
    - 实现 `validate()` 方法
    - 验证每个收款人地址和金额
    - 实现批量大小限制 (500)
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [x] 10.2 实现批量提交和状态追踪
    - 实现 `submit()` 方法
    - 实现 `getStatus()` 方法
    - 实现 `retry()` 方法
    - 实现 `poll()` 方法
    - _Requirements: 12.3, 12.4_

  - [ ]* 10.3 编写批量支付属性测试
    - **Property 11: Batch Validation Completeness**
    - **Property 12: Batch Size Limit**
    - **Validates: Requirements 12.2, 12.5, 12.6**

- [x] 11. Checkpoint - 核心模块验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 12. Webhook 模块实现
  - [x] 12.1 实现 Webhook 签名验证
    - 创建 `src/modules/webhooks.ts`
    - 实现 `verify()` 方法
    - 实现 `sign()` 方法 (用于测试)
    - 实现常量时间比较防止时序攻击
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 12.2 实现 Webhook 事件解析
    - 实现 `parse()` 方法
    - 支持 payment.completed, payment.failed, payment.expired
    - 支持 batch.completed, batch.failed
    - 支持 x402.executed
    - _Requirements: 10.3, 10.5_

  - [ ]* 12.3 编写 Webhook 属性测试
    - **Property 14: Webhook Signature Verification**
    - **Validates: Requirements 10.2**

- [ ] 13. SDK 客户端集成
  - [x] 13.1 实现 ProtocolBanksClient
    - 创建 `src/client.ts`
    - 实现构造函数和配置验证
    - 集成所有模块 (links, payments, x402, batch, webhooks, checkout)
    - 实现 `initialize()` 和 `close()` 方法
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 13.2 实现认证和令牌管理
    - 实现 API 密钥验证
    - 实现令牌自动刷新
    - 实现环境切换 (production/sandbox/testnet)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 13.3 编写认证属性测试
    - 测试有效/无效凭证处理
    - 测试环境配置
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 14. 安全性实现
  - [x] 14.1 实现敏感数据保护
    - 创建安全日志记录器
    - 过滤 API 密钥、签名、私钥
    - 实现安全存储建议
    - _Requirements: 16.1, 16.4_

  - [ ]* 14.2 编写安全性属性测试
    - **Property 15: Sensitive Data Protection**
    - **Property 16: HTTPS Enforcement**
    - **Validates: Requirements 16.1, 16.2**

- [x] 15. Checkpoint - TypeScript SDK 完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 16. Python SDK 实现
  - [x] 16.1 创建 Python SDK 项目结构
    - 初始化 `protocolbanks` 包
    - 配置 pyproject.toml 和 setup.py
    - 配置 pytest 和 hypothesis
    - _Requirements: 15.2_

  - [x] 16.2 移植核心模块到 Python
    - 移植 PaymentLinkModule
    - 移植 X402Module
    - 移植 BatchModule
    - 移植 WebhookModule
    - _Requirements: 15.2, 15.5_

  - [ ]* 16.3 编写 Python 属性测试
    - 使用 Hypothesis 实现所有属性测试
    - 验证与 TypeScript SDK 行为一致
    - _Requirements: 15.5_

- [x] 17. Go SDK 实现
  - [x] 17.1 创建 Go SDK 项目结构
    - 初始化 `protocolbanks-go` 模块
    - 配置 go.mod
    - 配置 testing 和 rapid
    - _Requirements: 15.3_

  - [x] 17.2 移植核心模块到 Go
    - 移植 PaymentLinkModule
    - 移植 X402Module
    - 移植 BatchModule
    - 移植 WebhookModule
    - _Requirements: 15.3, 15.5_

  - [ ]* 17.3 编写 Go 属性测试
    - 使用 rapid 实现所有属性测试
    - 验证与 TypeScript SDK 行为一致
    - _Requirements: 15.5_

  - [ ]* 17.4 编写 API 一致性测试
    - **Property 17: API Consistency Across Languages**
    - **Validates: Requirements 15.5**

- [ ] 18. Checkpoint - 多语言 SDK 完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 19. 文档编写
  - [x] 19.1 编写 README 和快速入门
    - TypeScript SDK README (含嵌入式组件)
    - Python SDK README
    - Go SDK README
    - 5 分钟快速集成指南
    - _Requirements: 17.1_

  - [x] 19.2 编写 API 参考文档
    - 使用 TypeDoc 生成 TypeScript 文档
    - 使用 Sphinx 生成 Python 文档
    - 使用 godoc 生成 Go 文档
    - _Requirements: 17.2_

  - [x] 19.3 编写集成指南
    - Next.js 集成指南
    - Express 集成指南
    - FastAPI 集成指南
    - Gin 集成指南
    - Shopify 插件指南
    - WordPress 插件指南
    - _Requirements: 17.4, 13.4_

  - [x] 19.4 编写故障排除指南
    - 常见错误和解决方案
    - 调试技巧
    - FAQ
    - _Requirements: 17.5_

- [ ] 20. 发布准备
  - [x] 20.1 配置 CI/CD
    - GitHub Actions 自动测试
    - 自动发布到 npm/PyPI/Go modules
    - 版本管理

  - [ ] 20.2 发布 SDK
    - 发布 `@protocolbanks/sdk` 到 npm
    - 发布 `@protocolbanks/react` 到 npm
    - 发布 `protocolbanks` 到 PyPI
    - 发布 `protocolbanks-go` 到 GitHub

- [ ] 21. Final Checkpoint - SDK 发布完成
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- TypeScript SDK is the reference implementation; Python and Go follow the same patterns
- 嵌入式组件 (任务 6-7) 是快速部署的核心功能，优先实现

## Quick Integration Examples

### 最简单的集成 (一行代码)

```html
<script src="https://sdk.protocolbanks.com/checkout.js" 
        data-api-key="pk_live_xxx"
        data-amount="100"
        data-token="USDC"
        data-recipient="0x1234...">
</script>
```

### React 集成

```tsx
import { PaymentButton } from '@protocolbanks/react';

<PaymentButton 
  amount="100" 
  token="USDC" 
  recipientAddress="0x1234..."
  onSuccess={(result) => console.log('Paid!', result)}
/>
```

### 服务端集成

```typescript
import { ProtocolBanksClient } from '@protocolbanks/sdk';

const client = new ProtocolBanksClient({ apiKey: 'pk_live_xxx' });
const link = client.links.generate({
  to: '0x1234...',
  amount: '100',
  token: 'USDC'
});
```
