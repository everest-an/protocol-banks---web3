# Protocol Banks iOS - 开发指南

## 目录
1. [开发环境设置](#开发环境设置)
2. [项目结构](#项目结构)
3. [开发工作流](#开发工作流)
4. [代码规范](#代码规范)
5. [测试指南](#测试指南)
6. [调试技巧](#调试技巧)
7. [性能优化](#性能优化)
8. [部署流程](#部署流程)

## 开发环境设置

### 系统要求
- macOS 12.0 或更高版本
- Xcode 15.0 或更高版本
- Swift 5.9 或更高版本
- iOS 16.0+ 设备或模拟器

### 安装步骤

1. **安装Xcode**
```bash
# 从App Store安装或使用命令行工具
xcode-select --install
```

2. **克隆项目**
```bash
git clone https://github.com/everest-an/protocol-banks-ios.git
cd ProtocolBanksIOS
```

3. **安装依赖**
```bash
# 使用Swift Package Manager
# 在Xcode中: File > Add Packages

# 或使用CocoaPods
pod install
```

4. **配置环境变量**
创建 `Config.xcconfig` 文件:
```
// API配置
API_BASE_URL = https://api.protocolbanks.com
ETHERSCAN_API_KEY = YOUR_API_KEY

// WalletConnect配置
WALLET_CONNECT_PROJECT_ID = YOUR_PROJECT_ID

// Alchemy配置
ALCHEMY_API_KEY = YOUR_API_KEY
```

5. **运行应用**
```bash
# 在Xcode中
Cmd+R

# 或使用命令行
xcodebuild -scheme ProtocolBanksIOS -configuration Debug
```

## 项目结构

```
ProtocolBanksIOS/
├── App/                          # 应用入口
│   └── ProtocolBanksApp.swift
├── Models/                       # 数据模型
│   └── DataModels.swift
├── ViewModels/                   # 视图模型
│   └── ViewModels.swift
├── Views/                        # UI视图
│   ├── MainTabView.swift
│   ├── AuthViews.swift
│   ├── AdvancedViews.swift
│   └── Components/
│       └── BaseComponents.swift
├── Services/                     # 业务服务
│   ├── APIClient.swift
│   ├── Web3Service.swift
│   └── BusinessServices.swift
├── Managers/                     # 管理器
│   ├── WalletManager.swift
│   ├── ThemeManager.swift
│   └── StorageManager.swift
├── Repositories/                 # 数据访问层
├── Utilities/                    # 工具类
├── Resources/                    # 资源文件
│   ├── Assets.xcassets
│   └── Localizable.strings
└── Tests/                        # 单元测试
    └── ProtocolBanksIOSTests.swift
```

## 开发工作流

### 创建新功能

1. **创建数据模型** (如果需要)
```swift
// Models/DataModels.swift
struct NewModel: Codable, Identifiable {
    let id: String
    var property: String
}
```

2. **创建ViewModel**
```swift
// ViewModels/ViewModels.swift
class NewFeatureViewModel: ObservableObject {
    @Published var data: [NewModel] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    func loadData() {
        // 实现数据加载逻辑
    }
}
```

3. **创建View**
```swift
// Views/NewFeatureView.swift
struct NewFeatureView: View {
    @StateObject private var viewModel = NewFeatureViewModel()
    
    var body: some View {
        // 实现UI
    }
}
```

4. **添加到导航**
```swift
// Views/MainTabView.swift
TabView(selection: $selectedTab) {
    NewFeatureView()
        .tag(MainTab.newFeature)
        .tabItem {
            Label("New Feature", systemImage: "icon")
        }
}
```

### 添加API端点

1. **在APIClient中添加方法**
```swift
// Services/APIClient.swift
func fetchNewData() async throws -> [NewModel] {
    let endpoint = "/new-endpoint"
    return try await request(endpoint, method: .get)
}
```

2. **在ViewModel中调用**
```swift
func loadData() {
    Task {
        do {
            let data = try await apiClient.fetchNewData()
            await MainActor.run {
                self.data = data
            }
        } catch {
            // 处理错误
        }
    }
}
```

## 代码规范

### 命名规范
- **类和结构体**: PascalCase (e.g., `WalletManager`)
- **函数和变量**: camelCase (e.g., `fetchWalletData()`)
- **常量**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **枚举**: PascalCase (e.g., `TransactionStatus`)

### 代码风格
```swift
// 使用MARK注释组织代码
// MARK: - Properties
@Published var data: [Model] = []

// MARK: - Methods
func loadData() {
    // 实现
}

// MARK: - Private Methods
private func processData() {
    // 实现
}
```

### 错误处理
```swift
// 创建自定义错误类型
enum CustomError: LocalizedError {
    case invalidInput
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidInput:
            return "Invalid input provided"
        case .networkError(let error):
            return "Network error: \\(error.localizedDescription)"
        }
    }
}

// 使用do-catch处理错误
do {
    let result = try await someAsyncOperation()
} catch {
    errorMessage = error.localizedDescription
}
```

### 异步编程
```swift
// 使用async/await
Task {
    do {
        let data = try await fetchData()
        await MainActor.run {
            self.data = data
        }
    } catch {
        // 处理错误
    }
}

// 避免回调地狱
// ❌ 不好
fetchData { result in
    processData(result) { processed in
        saveData(processed) { saved in
            // ...
        }
    }
}

// ✅ 好
let data = try await fetchData()
let processed = try await processData(data)
try await saveData(processed)
```

## 测试指南

### 单元测试

```swift
// Tests/ProtocolBanksIOSTests.swift
func testWalletConnection() {
    let expectation = XCTestExpectation(description: "Wallet connection")
    
    walletManager.connectWallet()
    
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        XCTAssertTrue(self.walletManager.isConnected)
        expectation.fulfill()
    }
    
    wait(for: [expectation], timeout: 5.0)
}
```

### 运行测试
```bash
# 运行所有测试
Cmd+U

# 运行特定测试
Cmd+Shift+U (选择测试)

# 命令行运行
xcodebuild test -scheme ProtocolBanksIOS
```

### 测试覆盖率
```bash
# 启用代码覆盖率
# Xcode: Product > Scheme > Edit Scheme > Test > Options > Code Coverage
```

## 调试技巧

### 使用Debugger
```swift
// 设置断点: 点击行号
// 条件断点: 右键点击断点 > Edit Breakpoint
// 调试命令:
// po object - 打印对象
// p variable - 打印变量
// bt - 打印堆栈跟踪
```

### 日志输出
```swift
// 使用os.log进行结构化日志
import os.log

let logger = Logger(subsystem: "com.protocolbanks.ios", category: "WalletManager")
logger.debug("Wallet connected: \\(address)")

// 或使用print (仅用于调试)
print("Debug info: \\(value)")
```

### 网络调试
```swift
// 使用Xcode的Network Link Conditioner模拟网络条件
// 或使用Charles/Fiddler进行HTTP代理调试
```

## 性能优化

### 内存优化
```swift
// 使用弱引用避免循环引用
class ViewController {
    weak var delegate: SomeDelegate?
}

// 及时释放大对象
var largeData: [UInt8]? = nil
// 使用后
largeData = nil
```

### 网络优化
```swift
// 请求缓存
let config = URLSessionConfiguration.default
config.requestCachePolicy = .returnCacheDataElseLoad
config.urlCache = URLCache(memoryCapacity: 10_000_000, diskCapacity: 100_000_000)

// 批量请求
async let data1 = fetchData1()
async let data2 = fetchData2()
let (result1, result2) = try await (data1, data2)
```

### UI性能
```swift
// 使用LazyVStack处理长列表
LazyVStack {
    ForEach(items) { item in
        ItemView(item: item)
    }
}

// 避免在View中进行重型计算
// ❌ 不好
var body: some View {
    Text("\\(expensiveCalculation())")
}

// ✅ 好
@State private var cachedValue = ""
var body: some View {
    Text(cachedValue)
        .onAppear {
            cachedValue = expensiveCalculation()
        }
}
```

## 部署流程

### 版本管理
1. **更新版本号**
   - 在 `Info.plist` 中更新 `CFBundleShortVersionString` (版本)
   - 更新 `CFBundleVersion` (构建号)

2. **更新变更日志**
```markdown
# v1.1.0 (2025-12-15)
- 新增功能X
- 修复Bug Y
- 性能改进Z
```

### 构建发布版本
```bash
# 清理构建
Cmd+Shift+K

# 构建Archive
Xcode: Product > Archive

# 或使用命令行
xcodebuild -scheme ProtocolBanksIOS -configuration Release archive
```

### App Store提交
1. 在App Store Connect中创建新版本
2. 上传构建版本
3. 填写发布说明
4. 选择发布方式 (自动或手动)
5. 提交审核

### TestFlight测试
```bash
# 上传到TestFlight
# Xcode: Window > Organizer > Archives > Distribute App

# 邀请测试者
# App Store Connect: TestFlight > Testers
```

### 监控和分析
- 使用Xcode Organizer监控崩溃和性能
- 集成Firebase或Sentry进行错误追踪
- 使用App Analytics分析用户行为

## 常见问题

### Q: 如何处理WalletConnect连接失败?
A: 检查项目ID配置，确保MetaMask应用已安装，检查网络连接。

### Q: 如何调试Web3交互?
A: 使用Etherscan API验证交易，检查RPC端点配置，使用测试网络进行测试。

### Q: 如何优化应用启动时间?
A: 延迟加载非关键资源，使用异步初始化，减少启动时的网络请求。

### Q: 如何处理内存泄漏?
A: 使用Xcode的Memory Debugger，检查循环引用，及时释放大对象。

## 参考资源

- [Apple Swift Documentation](https://developer.apple.com/swift/)
- [SwiftUI Documentation](https://developer.apple.com/xcode/swiftui/)
- [Combine Framework](https://developer.apple.com/documentation/combine)
- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [Web3.swift](https://github.com/web3swift-team/web3swift)
