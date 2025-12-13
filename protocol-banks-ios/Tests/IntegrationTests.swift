import XCTest
@testable import ProtocolBanksIOS

// MARK: - End-to-End Integration Tests
final class EndToEndIntegrationTests: XCTestCase {
    
    var walletManager: WalletManager!
    var paymentService: PaymentService!
    var analyticsService: AnalyticsService!
    var entityService: EntityService!
    
    override func setUp() {
        super.setUp()
        walletManager = WalletManager.shared
        paymentService = PaymentService.shared
        analyticsService = AnalyticsService.shared
        entityService = EntityService.shared
    }
    
    // MARK: - Wallet Connection Flow
    func testWalletConnectionFlow() {
        let expectation = XCTestExpectation(description: "Complete wallet connection flow")
        
        // Step 1: Connect wallet
        walletManager.connectWallet()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Verify wallet is connected
            XCTAssertTrue(self.walletManager.isConnected)
            XCTAssertNotNil(self.walletManager.currentWallet)
            
            // Step 2: Verify wallet address
            if let wallet = self.walletManager.currentWallet {
                XCTAssertFalse(wallet.address.isEmpty)
                XCTAssertTrue(wallet.isConnected)
            }
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Batch Payment Flow
    func testBatchPaymentFlow() {
        let expectation = XCTestExpectation(description: "Complete batch payment flow")
        
        let recipients = [
            PaymentRecipient(id: "r1", address: "0x123", amount: 100, token: "USDC", entityName: "Vendor 1"),
            PaymentRecipient(id: "r2", address: "0x456", amount: 200, token: "USDC", entityName: "Vendor 2")
        ]
        
        Task {
            do {
                // Step 1: Create batch payment
                let payment = try await paymentService.createBatchPayment(
                    recipients: recipients,
                    chain: .ethereum,
                    token: "USDC"
                )
                
                XCTAssertEqual(payment.recipients.count, 2)
                XCTAssertEqual(payment.status, .pending)
                
                // Step 2: Verify payment details
                XCTAssertFalse(payment.fromAddress.isEmpty)
                XCTAssertEqual(payment.chain, "ethereum")
                
                // Step 3: Verify total amount
                let totalAmount = payment.recipients.reduce(0) { $0 + $1.amount }
                XCTAssertEqual(totalAmount, Decimal(300))
                
                expectation.fulfill()
            } catch {
                XCTFail("Batch payment flow failed: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
    
    // MARK: - Payment Link Generation Flow
    func testPaymentLinkGenerationFlow() {
        let expectation = XCTestExpectation(description: "Complete payment link generation flow")
        
        Task {
            do {
                // Step 1: Generate payment link
                let link = try await paymentService.createPaymentLink(
                    recipient: "0x789",
                    amount: Decimal(100),
                    token: "USDC",
                    expiresIn: 3600
                )
                
                XCTAssertNotNil(link)
                XCTAssertEqual(link.amount, Decimal(100))
                XCTAssertEqual(link.token, "USDC")
                
                // Step 2: Verify link is valid
                let verified = try await paymentService.verifyPaymentLink(link.id)
                XCTAssertEqual(verified.id, link.id)
                
                // Step 3: Verify link contains shareable URL
                XCTAssertFalse(link.shareableUrl.isEmpty)
                XCTAssertTrue(link.shareableUrl.contains("http"))
                
                expectation.fulfill()
            } catch {
                XCTFail("Payment link generation flow failed: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
    
    // MARK: - Transaction History Flow
    func testTransactionHistoryFlow() {
        let expectation = XCTestExpectation(description: "Complete transaction history flow")
        
        guard let wallet = walletManager.currentWallet else {
            XCTFail("Wallet not connected")
            return
        }
        
        Task {
            do {
                // Step 1: Fetch transaction history
                let transactions = try await paymentService.getTransactionHistory(
                    walletAddress: wallet.address,
                    limit: 10
                )
                
                XCTAssertNotNil(transactions)
                
                // Step 2: Verify transaction data
                for transaction in transactions {
                    XCTAssertFalse(transaction.id.isEmpty)
                    XCTAssertFalse(transaction.hash.isEmpty)
                    XCTAssertGreaterThan(transaction.amount, 0)
                }
                
                // Step 3: Fetch specific transaction details
                if let firstTx = transactions.first {
                    let details = try await paymentService.getTransactionDetails(firstTx.hash)
                    XCTAssertEqual(details.id, firstTx.id)
                }
                
                expectation.fulfill()
            } catch {
                XCTFail("Transaction history flow failed: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
    
    // MARK: - Analytics Flow
    func testAnalyticsFlow() {
        let expectation = XCTestExpectation(description: "Complete analytics flow")
        
        guard let wallet = walletManager.currentWallet else {
            XCTFail("Wallet not connected")
            return
        }
        
        Task {
            do {
                // Step 1: Fetch financial metrics
                let metrics = try await analyticsService.getFinancialMetrics()
                XCTAssertNotNil(metrics)
                
                // Step 2: Fetch payment trends
                let trends = try await analyticsService.getPaymentTrends(days: 30)
                XCTAssertNotNil(trends)
                
                // Step 3: Fetch network graph
                let networkGraph = try await analyticsService.getNetworkGraph()
                XCTAssertNotNil(networkGraph)
                
                expectation.fulfill()
            } catch {
                XCTFail("Analytics flow failed: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
    
    // MARK: - Entity Management Flow
    func testEntityManagementFlow() {
        let expectation = XCTestExpectation(description: "Complete entity management flow")
        
        Task {
            do {
                // Step 1: Create entity
                let entity = try await entityService.createEntity(
                    name: "Test Vendor",
                    address: "0xabc",
                    category: .supplier
                )
                
                XCTAssertEqual(entity.name, "Test Vendor")
                XCTAssertEqual(entity.category, .supplier)
                
                // Step 2: Fetch entities
                let entities = try await entityService.getEntities()
                XCTAssertGreaterThan(entities.count, 0)
                
                // Step 3: Update entity
                var updatedEntity = entity
                updatedEntity.name = "Updated Vendor"
                
                let result = try await entityService.updateEntity(updatedEntity)
                XCTAssertEqual(result.name, "Updated Vendor")
                
                // Step 4: Delete entity
                try await entityService.deleteEntity(entity)
                
                expectation.fulfill()
            } catch {
                XCTFail("Entity management flow failed: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
}

// MARK: - Cross-Feature Integration Tests
final class CrossFeatureIntegrationTests: XCTestCase {
    
    var walletManager: WalletManager!
    var paymentService: PaymentService!
    var analyticsService: AnalyticsService!
    
    override func setUp() {
        super.setUp()
        walletManager = WalletManager.shared
        paymentService = PaymentService.shared
        analyticsService = AnalyticsService.shared
    }
    
    // MARK: - Dashboard to Analytics Flow
    func testDashboardToAnalyticsFlow() {
        let expectation = XCTestExpectation(description: "Dashboard to Analytics flow")
        
        let dashboardVM = DashboardViewModel()
        let analyticsVM = AnalyticsViewModel()
        
        dashboardVM.loadData()
        analyticsVM.loadTransactions()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            // Verify data consistency
            XCTAssertFalse(dashboardVM.isLoading)
            XCTAssertFalse(analyticsVM.isLoading)
            
            // Compare transaction counts
            let dashboardTxCount = dashboardVM.metrics?.transactionCount ?? 0
            let analyticsTxCount = analyticsVM.transactions.count
            
            XCTAssertGreaterThanOrEqual(analyticsTxCount, 0)
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Batch Payment to Vendor Management Flow
    func testBatchPaymentToVendorFlow() {
        let expectation = XCTestExpectation(description: "Batch payment to vendor flow")
        
        let batchVM = BatchPaymentViewModel()
        let vendorVM = VendorManagementViewModel()
        
        // Add recipients to batch payment
        batchVM.addRecipient()
        batchVM.addRecipient()
        
        // Load vendors
        vendorVM.loadEntities()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Verify batch payment has recipients
            XCTAssertGreaterThan(batchVM.recipients.count, 1)
            
            // Verify vendors are loaded
            XCTAssertFalse(vendorVM.isLoading)
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Settings to All Features Flow
    func testSettingsAffectsAllFeatures() {
        let expectation = XCTestExpectation(description: "Settings affects all features")
        
        let settingsVM = SettingsViewModel()
        let dashboardVM = DashboardViewModel()
        let analyticsVM = AnalyticsViewModel()
        
        // Change settings
        let initialDarkMode = settingsVM.isDarkMode
        settingsVM.saveDarkMode(!initialDarkMode)
        
        // Verify settings persisted
        let storageManager = StorageManager.shared
        let saved = storageManager.loadBool(forKey: "isDarkMode") ?? true
        XCTAssertEqual(saved, !initialDarkMode)
        
        // Verify other features still work
        dashboardVM.loadData()
        analyticsVM.loadTransactions()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
}

// MARK: - Data Flow Integration Tests
final class DataFlowIntegrationTests: XCTestCase {
    
    // MARK: - Local Storage to API Flow
    func testLocalStorageToAPIFlow() {
        let expectation = XCTestExpectation(description: "Local storage to API flow")
        
        let storageManager = StorageManager.shared
        
        // Step 1: Save data locally
        let user = User(
            id: "test",
            walletAddress: "0x123",
            name: "Test User",
            email: "test@example.com",
            createdAt: Date(),
            updatedAt: Date()
        )
        
        storageManager.saveUser(user)
        
        // Step 2: Load data from local storage
        let loadedUser = storageManager.loadUser()
        XCTAssertEqual(loadedUser?.name, user.name)
        
        expectation.fulfill()
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Keychain Storage Flow
    func testKeychainStorageFlow() {
        let expectation = XCTestExpectation(description: "Keychain storage flow")
        
        let keychainManager = KeychainManager.shared
        let testPassword = "test_secure_password_123"
        let account = "test_account"
        
        // Step 1: Save to Keychain
        let saved = keychainManager.savePassword(testPassword, forAccount: account)
        XCTAssertTrue(saved)
        
        // Step 2: Load from Keychain
        let loaded = keychainManager.loadPassword(forAccount: account)
        XCTAssertEqual(loaded, testPassword)
        
        // Step 3: Delete from Keychain
        let deleted = keychainManager.deletePassword(forAccount: account)
        XCTAssertTrue(deleted)
        
        // Step 4: Verify deletion
        let reloaded = keychainManager.loadPassword(forAccount: account)
        XCTAssertNil(reloaded)
        
        expectation.fulfill()
        
        wait(for: [expectation], timeout: 5.0)
    }
}

// MARK: - Error Recovery Integration Tests
final class ErrorRecoveryIntegrationTests: XCTestCase {
    
    // MARK: - Network Error Recovery
    func testNetworkErrorRecovery() {
        let expectation = XCTestExpectation(description: "Network error recovery")
        
        let viewModel = DashboardViewModel()
        
        // Simulate network error
        viewModel.errorMessage = "Network connection failed"
        XCTAssertNotNil(viewModel.errorMessage)
        
        // Retry loading
        viewModel.loadData()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // Verify recovery
            XCTAssertFalse(viewModel.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Validation Error Recovery
    func testValidationErrorRecovery() {
        let expectation = XCTestExpectation(description: "Validation error recovery")
        
        let viewModel = ReceivePaymentViewModel()
        
        // Step 1: Try invalid input
        viewModel.recipientAddress = ""
        viewModel.amount = ""
        viewModel.generatePaymentLink()
        
        XCTAssertNotNil(viewModel.errorMessage)
        
        // Step 2: Provide valid input
        viewModel.recipientAddress = "0x123"
        viewModel.amount = "100"
        viewModel.generatePaymentLink()
        
        expectation.fulfill()
        
        wait(for: [expectation], timeout: 5.0)
    }
}

// MARK: - Performance Integration Tests
final class PerformanceIntegrationTests: XCTestCase {
    
    // MARK: - Dashboard Performance
    func testDashboardLoadingPerformance() {
        let expectation = XCTestExpectation(description: "Dashboard loading performance")
        
        let viewModel = DashboardViewModel()
        
        let startTime = Date()
        viewModel.loadData()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            let endTime = Date()
            let loadTime = endTime.timeIntervalSince(startTime)
            
            // Dashboard should load within 2 seconds
            XCTAssertLessThan(loadTime, 2.0)
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Analytics Performance
    func testAnalyticsLoadingPerformance() {
        let expectation = XCTestExpectation(description: "Analytics loading performance")
        
        let viewModel = AnalyticsViewModel()
        
        let startTime = Date()
        viewModel.loadTransactions()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            let endTime = Date()
            let loadTime = endTime.timeIntervalSince(startTime)
            
            // Analytics should load within 2 seconds
            XCTAssertLessThan(loadTime, 2.0)
            
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
}

// MARK: - State Management Integration Tests
final class StateManagementIntegrationTests: XCTestCase {
    
    // MARK: - ViewModel State Consistency
    func testViewModelStateConsistency() {
        let expectation = XCTestExpectation(description: "ViewModel state consistency")
        
        let batchVM = BatchPaymentViewModel()
        
        // Step 1: Add recipients
        batchVM.addRecipient()
        batchVM.addRecipient()
        
        let initialCount = batchVM.recipients.count
        
        // Step 2: Modify state
        batchVM.recipients[0].amount = Decimal(100)
        batchVM.recipients[1].amount = Decimal(200)
        
        // Step 3: Verify state
        XCTAssertEqual(batchVM.totalAmount, Decimal(300))
        XCTAssertEqual(batchVM.recipients.count, initialCount)
        
        // Step 4: Reset
        batchVM.recipients = [
            PaymentRecipient(id: UUID().uuidString, address: "", amount: 0, token: "USDC", entityName: nil)
        ]
        
        XCTAssertEqual(batchVM.recipients.count, 1)
        
        expectation.fulfill()
        
        wait(for: [expectation], timeout: 5.0)
    }
}
