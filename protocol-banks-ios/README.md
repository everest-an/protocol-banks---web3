# Protocol Banks iOS App

完整的iOS原生应用，复制Protocol Banks网页版所有功能，采用Swift + SwiftUI技术栈。

## 项目概述

Protocol Banks iOS是一个企业级加密支付管理应用，提供批量支付、钱包管理、交易分析、实体网络可视化等功能。应用支持多链交互、Web3钱包集成，为用户提供专业级的加密资产管理体验。

## 功能特性

### 核心功能模块

**仪表板 (Dashboard)**
- 关键财务指标展示 (总发送金额、交易数量、钱包标签数等)
- 财务健康指标 (月度燃烧率、预计运行时间、顶级支出类别等)
- 支付趋势图表
- 供应商详情列表
- 最近交易记录

**批量支付 (Batch Payment)**
- 多链网络支持 (Ethereum, Base, Polygon, Arbitrum等)
- 多收款人管理
- 多种代币支持 (USDT, USDC, DAI)
- EIP-3009无Gas支付 (USDC)
- 实时余额显示
- 支付摘要和确认

**接收支付 (Receive Payments)**
- 安全的x402支付链接生成
- 加密签名链接
- 链接过期管理
- 防篡改检测
- 链接分享和复制功能

**分析 (Analytics)**
- 完整的交易历史
- 交易统计和分析
- 支付趋势可视化
- 支出分类
- 财务报告导出

**钱包管理 (Wallet Management)**
- MetaMask钱包连接 (通过WalletConnect)
- 多链账户支持
- 实时余额更新
- 账户切换
- 交易签名管理

**设置 (Settings)**
- 用户偏好设置
- 钱包管理
- 安全设置
- 应用信息

## 技术栈

### 开发框架
- **语言**: Swift 5.9+
- **UI框架**: SwiftUI
- **最低iOS版本**: iOS 16.0

### 依赖库
- **Web3**: web3swift或ethers-swift
- **钱包连接**: WalletConnect SDK v2
- **网络通信**: URLSession (内置) + Alamofire
- **JSON处理**: Codable (内置) + SwiftyJSON
- **安全存储**: Keychain Access
- **图表**: Charts库
- **包管理**: Swift Package Manager

### 架构模式
- **MVVM** (Model-View-ViewModel)
- **Clean Architecture**
- **Dependency Injection**
- **Repository Pattern**

## 项目结构

```
ProtocolBanksIOS/
├── App/
│   └── ProtocolBanksApp.swift          # 应用入口
├── Models/
│   └── DataModels.swift                # 数据模型定义
├── ViewModels/
│   └── ViewModels.swift                # 视图模型
├── Views/
│   ├── MainTabView.swift               # 主导航和各个页面
│   ├── AuthViews.swift                 # 启动屏幕和钱包连接
│   └── Components/
│       └── BaseComponents.swift        # 基础UI组件
├── Services/
│   └── APIClient.swift                 # API客户端
├── Managers/
│   ├── WalletManager.swift             # 钱包管理
│   ├── ThemeManager.swift              # 主题管理
│   └── StorageManager.swift            # 存储和Keychain管理
├── Repositories/                       # 数据访问层 (待实现)
├── Utilities/                          # 工具类 (待实现)
├── Resources/                          # 资源文件
└── Tests/                              # 单元测试
```

## 快速开始

### 前置条件
- Xcode 15.0+
- Swift 5.9+
- iOS 16.0+ 设备或模拟器
- CocoaPods或SPM包管理器

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd ProtocolBanksIOS
```

2. **安装依赖**
```bash
# 使用SPM (推荐)
# 在Xcode中: File > Add Packages > 输入依赖URL

# 或使用CocoaPods
pod install
```

3. **配置环境变量**
在`Managers/WalletManager.swift`中配置:
```swift
private let baseURL = "https://api.protocolbanks.com"
// 配置WalletConnect项目ID
// 配置Alchemy API密钥
```

4. **运行应用**
```bash
# 在Xcode中打开项目
open ProtocolBanksIOS.xcodeproj

# 选择目标设备或模拟器
# 按Cmd+R运行
```

## 核心模块说明

### 钱包管理 (WalletManager)
负责钱包连接、账户管理、余额查询等功能。

**关键方法:**
- `connectWallet()` - 连接钱包
- `disconnectWallet()` - 断开连接
- `switchWallet(_ wallet:)` - 切换钱包
- `refreshBalance()` - 刷新余额
- `signMessage(_ message:)` - 签名消息
- `signTransaction(_ transaction:)` - 签名交易

### API客户端 (APIClient)
处理所有API请求和数据同步。

**主要端点:**
- `/users/*` - 用户管理
- `/transactions/*` - 交易管理
- `/entities/*` - 实体管理
- `/payment-links/*` - 支付链接
- `/analytics/*` - 分析数据
- `/batch-payments/*` - 批量支付

### 存储管理 (StorageManager)
管理本地数据存储和缓存。

**功能:**
- UserDefaults存储
- Keychain安全存储
- 数据加密
- 缓存管理

### 主题管理 (ThemeManager)
管理应用主题和样式。

**功能:**
- 深色/浅色模式切换
- 品牌色管理
- 排版样式定义
- 间距和圆角常量

## 数据模型

### 核心实体

**User** - 用户信息
```swift
struct User {
    let id: String
    let walletAddress: String
    var name: String
    var email: String?
    let createdAt: Date
    var updatedAt: Date
}
```

**Wallet** - 钱包信息
```swift
struct Wallet {
    let id: String
    let address: String
    let chainId: Int
    var balance: Decimal
    var tokenBalances: [TokenBalance]
    var isConnected: Bool
    let lastUpdated: Date
}
```

**Transaction** - 交易记录
```swift
struct Transaction {
    let id: String
    let hash: String
    let from: String
    let to: String
    let amount: Decimal
    let token: String
    let chain: String
    let status: TransactionStatus
    let timestamp: Date
    var category: String?
    var notes: String?
}
```

**Entity** - 钱包标签/实体
```swift
struct Entity {
    let id: String
    var name: String
    let address: String
    let category: EntityCategory
    var totalPaid: Decimal
    var transactionCount: Int
    var healthScore: Double
    var lastTransactionDate: Date?
}
```

## 状态管理

应用采用**MVVM + ObservableObject**模式进行状态管理:

- **全局状态**: 通过`AppCoordinator`和`WalletManager`管理
- **页面状态**: 每个页面有对应的ViewModel
- **本地状态**: 使用`@State`和`@Binding`

## 安全特性

- **私钥管理**: 私钥永不存储在本地，通过WalletConnect进行远程签名
- **Keychain存储**: 敏感数据使用Keychain加密存储
- **HTTPS通信**: 所有API通信使用HTTPS
- **数据隔离**: 数据按用户钱包地址隔离
- **签名验证**: 支付链接和交易都进行签名验证

## 开发指南

### 添加新页面

1. 创建新的SwiftUI View
2. 创建对应的ViewModel
3. 在MainTabView中添加导航

### 添加新API端点

1. 在APIClient中添加方法
2. 定义对应的数据模型
3. 在ViewModel中调用

### 测试

```bash
# 运行单元测试
Cmd+U

# 运行UI测试
Cmd+Shift+U
```

## 构建和发布

### 构建配置

- **Debug**: 用于开发和测试
- **Release**: 用于App Store发布

### 版本管理

- 遵循语义版本控制 (Semantic Versioning)
- 更新`Info.plist`中的版本号
- 维护`CHANGELOG.md`

### App Store发布

1. 在App Store Connect中创建应用
2. 配置应用信息和隐私政策
3. 上传构建版本
4. 提交审核

## 常见问题

### Q: 如何连接MetaMask?
A: 应用使用WalletConnect协议连接MetaMask。用户点击"Connect MetaMask"按钮，会打开MetaMask应用或网页进行授权。

### Q: 支持哪些区块链?
A: 目前支持Ethereum、Base、Polygon、Arbitrum、Optimism、Solana和Bitcoin。

### Q: 如何处理离线状态?
A: 应用会缓存本地数据，当网络恢复时自动同步。

### Q: 如何导出交易历史?
A: 在Analytics页面可以导出交易数据为CSV或PDF格式。

## 性能优化

- **列表虚拟化**: 长列表使用LazyVStack
- **图片缓存**: 实现图片缓存管理
- **网络优化**: 请求缓存和批量请求
- **内存管理**: 及时释放大对象，避免循环引用

## 贡献指南

欢迎提交Issue和Pull Request。请遵循以下规范:

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 许可证

本项目采用MIT许可证。详见`LICENSE`文件。

## 联系方式

- 官网: https://protocolbanks.com
- 邮箱: protocolbanks@gmail.com
- GitHub: https://github.com/everest-an/protocol-banks---web3

## 更新日志

### v1.0.0 (2025-12-09)
- 初始发布
- 完整实现所有核心功能
- 支持多链交互
- Web3钱包集成
