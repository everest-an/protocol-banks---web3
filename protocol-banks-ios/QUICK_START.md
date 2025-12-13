# Protocol Banks iOS - 快速开始指南

## 5分钟快速启动

### 1. 环境检查
```bash
# 检查Xcode版本
xcode-select --version

# 检查Swift版本
swift --version
```

### 2. 克隆和配置
```bash
# 克隆项目
git clone <repository-url>
cd ProtocolBanksIOS

# 安装依赖 (使用SPM或CocoaPods)
pod install  # 如果使用CocoaPods
```

### 3. 在Xcode中打开
```bash
# 打开项目
open ProtocolBanksIOS.xcodeproj

# 或使用workspace (如果使用CocoaPods)
open ProtocolBanksIOS.xcworkspace
```

### 4. 配置API端点
编辑 `Services/APIClient.swift`:
```swift
private let baseURL = "https://api.protocolbanks.com"
```

### 5. 运行应用
- 选择模拟器或设备
- 按 `Cmd+R` 运行

## 项目结构一览

```
ProtocolBanksIOS/
├── App/                    # 应用入口
├── Models/                 # 数据模型
├── ViewModels/             # 视图模型
├── Views/                  # UI视图
├── Services/               # 业务服务
├── Managers/               # 管理器
├── Tests/                  # 单元测试
└── Resources/              # 资源文件
```

## 核心文件说明

| 文件 | 用途 | 关键类/函数 |
|------|------|-----------|
| ProtocolBanksApp.swift | 应用入口 | ProtocolBanksApp, AppCoordinator |
| DataModels.swift | 数据模型 | User, Wallet, Transaction, Entity |
| ViewModels.swift | 视图模型 | DashboardViewModel, BatchPaymentViewModel |
| MainTabView.swift | 主导航 | DashboardView, BatchPaymentView |
| APIClient.swift | API客户端 | APIClient, 所有API方法 |
| Web3Service.swift | Web3交互 | Web3Manager, ERC20Service |
| WalletManager.swift | 钱包管理 | WalletManager, 钱包操作 |

## 常见任务

### 添加新页面
1. 创建 `Views/NewFeatureView.swift`
2. 创建对应的 ViewModel
3. 在 `MainTabView.swift` 中添加导航

### 调用API
```swift
// 在ViewModel中
Task {
    do {
        let data = try await APIClient.shared.fetchData()
        await MainActor.run {
            self.data = data
        }
    } catch {
        self.errorMessage = error.localizedDescription
    }
}
```

### 连接钱包
```swift
// 在View中
Button("Connect Wallet") {
    WalletManager.shared.connectWallet()
}
```

### 提交交易
```swift
// 使用Web3Manager
let txHash = try await Web3Manager.shared.transferToken(
    tokenAddress: "0x...",
    to: "0x...",
    amount: 100,
    chain: .ethereum
)
```

## 调试技巧

### 查看日志
```swift
// 在代码中添加日志
print("Debug: \\(value)")

// 或使用os.log
import os.log
let logger = Logger(subsystem: "com.protocolbanks", category: "Debug")
logger.debug("Message: \\(value)")
```

### 设置断点
1. 点击代码行号左侧
2. 运行应用，执行到断点时暂停
3. 在LLDB控制台查看变量值

### 网络调试
- 使用Charles或Fiddler拦截HTTP请求
- 检查API响应格式
- 验证请求参数

## 常见问题

**Q: 如何连接真实钱包?**
A: 使用WalletConnect协议，通过MetaMask应用进行连接。

**Q: 如何测试批量支付?**
A: 在测试网络上运行，使用测试代币进行交易。

**Q: 如何处理API错误?**
A: 检查网络连接，验证API端点，查看错误日志。

**Q: 如何优化应用性能?**
A: 使用LazyVStack处理长列表，缓存网络请求，及时释放资源。

## 有用的链接

- [Swift官方文档](https://developer.apple.com/swift/)
- [SwiftUI官方文档](https://developer.apple.com/xcode/swiftui/)
- [WalletConnect文档](https://docs.walletconnect.com/)
- [Ethereum开发文档](https://ethereum.org/developers)

## 下一步

1. 阅读 `README.md` 了解完整功能
2. 查看 `DEVELOPMENT_GUIDE.md` 学习开发规范
3. 运行单元测试: `Cmd+U`
4. 开始开发新功能！

---

**需要帮助?** 查看项目文档或提交Issue。
