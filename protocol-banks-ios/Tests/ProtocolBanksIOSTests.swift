import XCTest
@testable import ProtocolBanksIOS

final class ProtocolBanksIOSTests: XCTestCase {
    
    var walletManager: WalletManager!
    var apiClient: APIClient!
    var paymentService: PaymentService!
    var analyticsService: AnalyticsService!
    
    override func setUp() {
        super.setUp()
        walletManager = WalletManager.shared
        apiClient = APIClient.shared
        paymentService = PaymentService.shared
        analyticsService = AnalyticsService.shared
    }
    
    override func tearDown() {
        super.tearDown()
    }
    
    // MARK: - Wallet Manager Tests
    func testWalletConnection() {
        let expectation = XCTestExpectation(description: "Wallet connection")
        
        walletManager.connectWallet()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            XCTAssertTrue(self.walletManager.isConnected)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testWalletDisconnection() {
        walletManager.connectWallet()
        walletManager.disconnectWallet()
        
        XCTAssertFalse(walletManager.isConnected)
        XCTAssertNil(walletManager.currentWallet)
    }
    
    // MARK: - Data Model Tests
    func testUserModel() {
        let user = User(
            id: "test-id",
            walletAddress: "0x123...",
            name: "Test User",
            email: "test@example.com",
            createdAt: Date(),
            updatedAt: Date()
        )
        
        XCTAssertEqual(user.name, "Test User")
        XCTAssertEqual(user.email, "test@example.com")
    }
    
    func testWalletModel() {
        let wallet = Wallet(
            id: "wallet-id",
            address: "0x123...",
            chainId: 1,
            balance: Decimal(10.5),
            tokenBalances: [],
            isConnected: true,
            lastUpdated: Date()
        )
        
        XCTAssertEqual(wallet.address, "0x123...")
        XCTAssertEqual(wallet.balance, Decimal(10.5))
        XCTAssertTrue(wallet.isConnected)
    }
    
    func testTransactionModel() {
        let transaction = Transaction(
            id: "tx-id",
            hash: "0xabc...",
            from: "0x123...",
            to: "0x456...",
            amount: Decimal(100),
            token: "USDC",
            chain: "Ethereum",
            status: .completed,
            timestamp: Date(),
            category: "Payment",
            notes: "Test payment",
            gasUsed: nil,
            gasPrice: nil
        )
        
        XCTAssertEqual(transaction.token, "USDC")
        XCTAssertEqual(transaction.amount, Decimal(100))
        XCTAssertEqual(transaction.status, .completed)
    }
    
    func testEntityModel() {
        let entity = Entity(
            id: "entity-id",
            name: "Test Vendor",
            address: "0x789...",
            category: .supplier,
            totalPaid: Decimal(5000),
            transactionCount: 10,
            healthScore: 95.5,
            lastTransactionDate: Date()
        )
        
        XCTAssertEqual(entity.name, "Test Vendor")
        XCTAssertEqual(entity.category, .supplier)
        XCTAssertEqual(entity.healthScore, 95.5)
    }
    
    // MARK: - Payment Service Tests
    func testCreateBatchPayment() {
        let recipients = [
            PaymentRecipient(
                id: "r1",
                address: "0x123...",
                amount: Decimal(100),
                token: "USDC",
                entityName: "Vendor 1"
            ),
            PaymentRecipient(
                id: "r2",
                address: "0x456...",
                amount: Decimal(200),
                token: "USDC",
                entityName: "Vendor 2"
            )
        ]
        
        let expectation = XCTestExpectation(description: "Create batch payment")
        
        Task {
            do {
                let payment = try await paymentService.createBatchPayment(
                    recipients: recipients,
                    chain: .ethereum,
                    token: "USDC"
                )
                
                XCTAssertEqual(payment.recipients.count, 2)
                XCTAssertEqual(payment.status, .pending)
                expectation.fulfill()
            } catch {
                XCTFail("Failed to create batch payment: \\(error)")
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Analytics Service Tests
    func testCalculateBurnRate() {
        let transactions = [
            Transaction(
                id: "1",
                hash: "0x1",
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
            ),
            Transaction(
                id: "2",
                hash: "0x2",
                from: "0x123",
                to: "0x789",
                amount: Decimal(200),
                token: "USDC",
                chain: "Ethereum",
                status: .completed,
                timestamp: Date(),
                category: nil,
                notes: nil,
                gasUsed: nil,
                gasPrice: nil
            )
        ]
        
        let burnRate = analyticsService.calculateBurnRate(transactions: transactions)
        XCTAssertGreaterThan(burnRate, 0)
    }
    
    func testCalculateAverageTransaction() {
        let transactions = [
            Transaction(
                id: "1",
                hash: "0x1",
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
            ),
            Transaction(
                id: "2",
                hash: "0x2",
                from: "0x123",
                to: "0x789",
                amount: Decimal(200),
                token: "USDC",
                chain: "Ethereum",
                status: .completed,
                timestamp: Date(),
                category: nil,
                notes: nil,
                gasUsed: nil,
                gasPrice: nil
            )
        ]
        
        let average = analyticsService.calculateAverageTransaction(transactions: transactions)
        XCTAssertEqual(average, Decimal(150))
    }
    
    func testGroupTransactionsByCategory() {
        let transactions = [
            Transaction(
                id: "1",
                hash: "0x1",
                from: "0x123",
                to: "0x456",
                amount: Decimal(100),
                token: "USDC",
                chain: "Ethereum",
                status: .completed,
                timestamp: Date(),
                category: "Infrastructure",
                notes: nil,
                gasUsed: nil,
                gasPrice: nil
            ),
            Transaction(
                id: "2",
                hash: "0x2",
                from: "0x123",
                to: "0x789",
                amount: Decimal(200),
                token: "USDC",
                chain: "Ethereum",
                status: .completed,
                timestamp: Date(),
                category: "Infrastructure",
                notes: nil,
                gasUsed: nil,
                gasPrice: nil
            ),
            Transaction(
                id: "3",
                hash: "0x3",
                from: "0x123",
                to: "0xabc",
                amount: Decimal(50),
                token: "USDC",
                chain: "Ethereum",
                status: .completed,
                timestamp: Date(),
                category: "Marketing",
                notes: nil,
                gasUsed: nil,
                gasPrice: nil
            )
        ]
        
        let grouped = analyticsService.groupTransactionsByCategory(transactions: transactions)
        
        XCTAssertEqual(grouped["Infrastructure"], Decimal(300))
        XCTAssertEqual(grouped["Marketing"], Decimal(50))
    }
    
    // MARK: - Storage Manager Tests
    func testSaveAndLoadWallet() {
        let wallet = Wallet(
            id: "test-wallet",
            address: "0x123...",
            chainId: 1,
            balance: Decimal(10),
            tokenBalances: [],
            isConnected: true,
            lastUpdated: Date()
        )
        
        let storageManager = StorageManager.shared
        storageManager.saveWallet(wallet)
        
        let loadedWallet = storageManager.loadWallet()
        XCTAssertEqual(loadedWallet?.address, wallet.address)
    }
    
    func testSaveAndLoadUser() {
        let user = User(
            id: "test-user",
            walletAddress: "0x123...",
            name: "Test User",
            email: "test@example.com",
            createdAt: Date(),
            updatedAt: Date()
        )
        
        let storageManager = StorageManager.shared
        storageManager.saveUser(user)
        
        let loadedUser = storageManager.loadUser()
        XCTAssertEqual(loadedUser?.name, user.name)
    }
    
    // MARK: - Keychain Tests
    func testKeychainStorage() {
        let keychainManager = KeychainManager.shared
        let testPassword = "test_password_123"
        let account = "test_account"
        
        let saved = keychainManager.savePassword(testPassword, forAccount: account)
        XCTAssertTrue(saved)
        
        let loaded = keychainManager.loadPassword(forAccount: account)
        XCTAssertEqual(loaded, testPassword)
        
        let deleted = keychainManager.deletePassword(forAccount: account)
        XCTAssertTrue(deleted)
    }
    
    // MARK: - Theme Manager Tests
    func testThemeToggle() {
        let themeManager = ThemeManager.shared
        let initialDarkMode = themeManager.isDarkMode
        
        themeManager.toggleDarkMode()
        XCTAssertNotEqual(themeManager.isDarkMode, initialDarkMode)
        
        themeManager.toggleDarkMode()
        XCTAssertEqual(themeManager.isDarkMode, initialDarkMode)
    }
}

// MARK: - Performance Tests
final class PerformanceTests: XCTestCase {
    func testWalletManagerPerformance() {
        let walletManager = WalletManager.shared
        
        measure {
            walletManager.connectWallet()
        }
    }
    
    func testDataDecodingPerformance() {
        let jsonData = """
        {
            "id": "test",
            "name": "Test",
            "address": "0x123",
            "category": "Supplier",
            "totalPaid": 1000,
            "transactionCount": 10,
            "healthScore": 95.5
        }
        """.data(using: .utf8)!
        
        measure {
            let decoder = JSONDecoder()
            _ = try? decoder.decode(Entity.self, from: jsonData)
        }
    }
}

// MARK: - Integration Tests
final class IntegrationTests: XCTestCase {
    func testWalletConnectAndFetchData() {
        let expectation = XCTestExpectation(description: "Wallet connect and fetch data")
        
        let walletManager = WalletManager.shared
        walletManager.connectWallet()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            XCTAssertTrue(walletManager.isConnected)
            XCTAssertNotNil(walletManager.currentWallet)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
}
