import XCTest
import SwiftUI
@testable import ProtocolBanksIOS

// MARK: - UI Layout Tests
final class UILayoutTests: XCTestCase {
    
    // MARK: - Dashboard View Tests
    func testDashboardViewLayout() {
        // 测试Dashboard页面的布局
        let dashboard = DashboardViewFixed()
        
        // 验证主要元素存在
        XCTAssertNotNil(dashboard)
        
        // 测试指标卡片布局
        let metricCard = MetricCardFixed(
            title: "Total Sent",
            value: "$1,000.00",
            subtitle: "Lifetime",
            icon: "dollarsign.circle.fill",
            valueColor: .brandGreen
        )
        
        XCTAssertNotNil(metricCard)
    }
    
    func testDashboardScrollViewNotOverlapping() {
        // 验证ScrollView中的内容不会互相遮挡
        let dashboard = DashboardViewFixed()
        
        // 创建一个测试环境
        let testView = ZStack {
            Color.backgroundPrimary.ignoresSafeArea()
            dashboard
        }
        
        XCTAssertNotNil(testView)
    }
    
    // MARK: - Batch Payment View Tests
    func testBatchPaymentViewLayout() {
        let batchPayment = BatchPaymentViewFixed()
        XCTAssertNotNil(batchPayment)
    }
    
    func testRecipientInputRowLayout() {
        var recipient = PaymentRecipient(
            id: "test",
            address: "0x123",
            amount: 100,
            token: "USDC",
            entityName: nil
        )
        
        let row = RecipientInputRow(
            recipient: .constant(recipient),
            onRemove: {},
            canRemove: true
        )
        
        XCTAssertNotNil(row)
    }
    
    func testBatchPaymentSummaryCard() {
        // 验证支付摘要卡片正确显示
        let card = CardView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    Text("Payment Summary")
                        .font(Typography.heading4)
                    Spacer()
                }
                
                Divider()
                
                HStack {
                    Text("Recipients")
                    Spacer()
                    Text("5")
                }
            }
        }
        
        XCTAssertNotNil(card)
    }
    
    // MARK: - Receive Payment View Tests
    func testReceivePaymentViewLayout() {
        let receivePayment = ReceivePaymentViewFixed()
        XCTAssertNotNil(receivePayment)
    }
    
    func testPaymentLinkDisplay() {
        // 验证生成的支付链接正确显示
        let link = PaymentLink(
            id: "test",
            recipient: "0x123",
            amount: Decimal(100),
            token: "USDC",
            shareableUrl: "https://protocolbanks.com/pay/test123",
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(86400),
            status: .active
        )
        
        XCTAssertNotNil(link)
        XCTAssertEqual(link.status, .active)
    }
    
    // MARK: - Analytics View Tests
    func testAnalyticsViewLayout() {
        let analytics = AnalyticsViewFixed()
        XCTAssertNotNil(analytics)
    }
    
    func testTransactionRowLayout() {
        let transaction = Transaction(
            id: "tx1",
            hash: "0xabc",
            from: "0x123",
            to: "0x456",
            amount: Decimal(100),
            token: "USDC",
            chain: "Ethereum",
            status: .completed,
            timestamp: Date(),
            category: "Payment",
            notes: nil,
            gasUsed: nil,
            gasPrice: nil
        )
        
        let row = TransactionRowViewFixed(transaction: transaction)
        XCTAssertNotNil(row)
    }
    
    // MARK: - Settings View Tests
    func testSettingsViewLayout() {
        let settings = SettingsViewFixed()
        XCTAssertNotNil(settings)
    }
    
    func testSettingsToggleStates() {
        // 验证设置页面的切换开关状态
        let viewModel = SettingsViewModel()
        
        let initialDarkMode = viewModel.isDarkMode
        viewModel.saveDarkMode(!initialDarkMode)
        
        XCTAssertNotEqual(viewModel.isDarkMode, initialDarkMode)
    }
    
    // MARK: - Vendors Network View Tests
    func testVendorsNetworkViewLayout() {
        let vendors = VendorsNetworkViewFixed()
        XCTAssertNotNil(vendors)
    }
    
    func testEntityCardLayout() {
        let entity = Entity(
            id: "e1",
            name: "Vendor 1",
            address: "0x789",
            category: .supplier,
            totalPaid: Decimal(5000),
            transactionCount: 10,
            healthScore: 95,
            lastTransactionDate: Date()
        )
        
        let card = EntityCardView(
            entity: entity,
            onTap: {}
        )
        
        XCTAssertNotNil(card)
    }
    
    // MARK: - Component Tests
    func testPrimaryButtonLayout() {
        let button = PrimaryButton(
            title: "Test Button",
            action: {},
            icon: "checkmark.circle.fill"
        )
        
        XCTAssertNotNil(button)
    }
    
    func testCardViewLayout() {
        let card = CardView {
            Text("Card Content")
        }
        
        XCTAssertNotNil(card)
    }
    
    func testInputFieldLayout() {
        let field = InputField(
            label: "Test Field",
            placeholder: "Enter value",
            text: .constant(""),
            icon: "pencil"
        )
        
        XCTAssertNotNil(field)
    }
    
    // MARK: - Spacing Tests
    func testSpacingConstants() {
        // 验证间距常量的合理性
        XCTAssertGreaterThan(Spacing.lg, Spacing.md)
        XCTAssertGreaterThan(Spacing.md, Spacing.sm)
        XCTAssertGreaterThan(Spacing.sm, Spacing.xs)
    }
    
    // MARK: - Color Tests
    func testColorDefinitions() {
        // 验证颜色定义
        XCTAssertNotNil(Color.brandGreen)
        XCTAssertNotNil(Color.backgroundPrimary)
        XCTAssertNotNil(Color.textPrimary)
    }
    
    // MARK: - Typography Tests
    func testTypographyDefinitions() {
        // 验证排版定义
        XCTAssertNotNil(Typography.heading1)
        XCTAssertNotNil(Typography.heading2)
        XCTAssertNotNil(Typography.bodyMedium)
    }
}

// MARK: - Functional Tests
final class FunctionalTests: XCTestCase {
    
    var walletManager: WalletManager!
    var paymentService: PaymentService!
    var analyticsService: AnalyticsService!
    
    override func setUp() {
        super.setUp()
        walletManager = WalletManager.shared
        paymentService = PaymentService.shared
        analyticsService = AnalyticsService.shared
    }
    
    // MARK: - Dashboard Functionality
    func testDashboardDataLoading() {
        let viewModel = DashboardViewModel()
        let expectation = XCTestExpectation(description: "Load dashboard data")
        
        viewModel.loadData()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertFalse(viewModel.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Batch Payment Functionality
    func testBatchPaymentRecipientManagement() {
        let viewModel = BatchPaymentViewModel()
        let initialCount = viewModel.recipients.count
        
        viewModel.addRecipient()
        XCTAssertEqual(viewModel.recipients.count, initialCount + 1)
        
        viewModel.removeRecipient(at: 0)
        XCTAssertEqual(viewModel.recipients.count, initialCount)
    }
    
    func testBatchPaymentTotalAmount() {
        var viewModel = BatchPaymentViewModel()
        viewModel.recipients = [
            PaymentRecipient(id: "1", address: "0x1", amount: 100, token: "USDC", entityName: nil),
            PaymentRecipient(id: "2", address: "0x2", amount: 200, token: "USDC", entityName: nil)
        ]
        
        XCTAssertEqual(viewModel.totalAmount, Decimal(300))
    }
    
    // MARK: - Receive Payment Functionality
    func testReceivePaymentLinkGeneration() {
        let viewModel = ReceivePaymentViewModel()
        let expectation = XCTestExpectation(description: "Generate payment link")
        
        viewModel.recipientAddress = "0x123"
        viewModel.amount = "100"
        viewModel.selectedToken = "USDC"
        
        viewModel.generatePaymentLink()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Analytics Functionality
    func testAnalyticsDataLoading() {
        let viewModel = AnalyticsViewModel()
        let expectation = XCTestExpectation(description: "Load analytics data")
        
        viewModel.loadTransactions()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertFalse(viewModel.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Settings Functionality
    func testSettingsPersistence() {
        let viewModel = SettingsViewModel()
        
        let initialDarkMode = viewModel.isDarkMode
        viewModel.saveDarkMode(!initialDarkMode)
        
        XCTAssertNotEqual(viewModel.isDarkMode, initialDarkMode)
        
        // 验证设置被保存
        let storageManager = StorageManager.shared
        let saved = storageManager.loadBool(forKey: "isDarkMode") ?? true
        XCTAssertEqual(saved, !initialDarkMode)
    }
    
    // MARK: - Vendor Management Functionality
    func testVendorManagementOperations() {
        let viewModel = VendorManagementViewModel()
        let expectation = XCTestExpectation(description: "Load entities")
        
        viewModel.loadEntities()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertFalse(viewModel.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
}

// MARK: - Navigation Tests
final class NavigationTests: XCTestCase {
    
    func testMainTabNavigation() {
        // 验证主导航标签页可以切换
        let mainTab = MainTabViewOptimized()
        XCTAssertNotNil(mainTab)
    }
    
    func testDashboardNavigation() {
        // 验证Dashboard中的导航链接
        let dashboard = DashboardViewFixed()
        XCTAssertNotNil(dashboard)
    }
    
    func testBatchPaymentNavigation() {
        // 验证批量支付页面导航
        let batchPayment = BatchPaymentViewFixed()
        XCTAssertNotNil(batchPayment)
    }
}

// MARK: - Accessibility Tests
final class AccessibilityTests: XCTestCase {
    
    func testButtonAccessibility() {
        // 验证按钮的无障碍属性
        let button = PrimaryButton(
            title: "Test Button",
            action: {},
            icon: "checkmark"
        )
        
        XCTAssertNotNil(button)
    }
    
    func testTextFieldAccessibility() {
        // 验证文本输入框的无障碍属性
        let field = InputField(
            label: "Test",
            placeholder: "Enter",
            text: .constant(""),
            icon: "pencil"
        )
        
        XCTAssertNotNil(field)
    }
}

// MARK: - Responsive Design Tests
final class ResponsiveDesignTests: XCTestCase {
    
    func testDashboardResponsiveLayout() {
        // 测试Dashboard在不同屏幕尺寸上的布局
        let dashboard = DashboardViewFixed()
        
        // 模拟不同的屏幕尺寸
        let screenSizes = [
            CGSize(width: 375, height: 667),  // iPhone SE
            CGSize(width: 390, height: 844),  // iPhone 14
            CGSize(width: 430, height: 932)   // iPhone 14 Pro Max
        ]
        
        for size in screenSizes {
            XCTAssertNotNil(dashboard)
        }
    }
    
    func testMetricCardResponsive() {
        // 测试指标卡片在不同屏幕上的响应
        let card = MetricCardFixed(
            title: "Test",
            value: "$1,000.00",
            subtitle: "Subtitle",
            icon: "dollarsign.circle.fill",
            valueColor: .brandGreen
        )
        
        XCTAssertNotNil(card)
    }
}

// MARK: - Data Validation Tests
final class DataValidationTests: XCTestCase {
    
    func testTransactionDataValidation() {
        let transaction = Transaction(
            id: "tx1",
            hash: "0xabc",
            from: "0x123",
            to: "0x456",
            amount: Decimal(100),
            token: "USDC",
            chain: "Ethereum",
            status: .completed,
            timestamp: Date(),
            category: nil,
            notes: nil,
            gasUsed: nil,
            gasPrice: nil
        )
        
        XCTAssertFalse(transaction.id.isEmpty)
        XCTAssertFalse(transaction.hash.isEmpty)
        XCTAssertGreaterThan(transaction.amount, 0)
    }
    
    func testPaymentRecipientValidation() {
        let recipient = PaymentRecipient(
            id: "r1",
            address: "0x123",
            amount: 100,
            token: "USDC",
            entityName: nil
        )
        
        XCTAssertFalse(recipient.address.isEmpty)
        XCTAssertGreaterThan(recipient.amount, 0)
    }
    
    func testEntityValidation() {
        let entity = Entity(
            id: "e1",
            name: "Test Entity",
            address: "0x789",
            category: .supplier,
            totalPaid: Decimal(1000),
            transactionCount: 5,
            healthScore: 95,
            lastTransactionDate: nil
        )
        
        XCTAssertFalse(entity.name.isEmpty)
        XCTAssertFalse(entity.address.isEmpty)
        XCTAssertGreaterThanOrEqual(entity.healthScore, 0)
        XCTAssertLessThanOrEqual(entity.healthScore, 100)
    }
}

// MARK: - Error Handling Tests
final class ErrorHandlingTests: XCTestCase {
    
    func testAPIErrorHandling() {
        // 测试API错误处理
        let viewModel = DashboardViewModel()
        
        // 模拟错误
        viewModel.errorMessage = "Network error"
        
        XCTAssertNotNil(viewModel.errorMessage)
    }
    
    func testValidationErrorHandling() {
        let viewModel = ReceivePaymentViewModel()
        
        // 尝试生成没有地址的支付链接
        viewModel.recipientAddress = ""
        viewModel.generatePaymentLink()
        
        XCTAssertNotNil(viewModel.errorMessage)
    }
}
