import Foundation
import Combine

// MARK: - Payment Service
class PaymentService {
    static let shared = PaymentService()
    
    private let apiClient = APIClient.shared
    private let web3Manager = Web3Manager.shared
    private let walletManager = WalletManager.shared
    
    // MARK: - Batch Payment
    func createBatchPayment(
        recipients: [PaymentRecipient],
        chain: BlockchainChain,
        token: String
    ) async throws -> BatchPayment {
        guard let wallet = walletManager.currentWallet else {
            throw PaymentError.walletNotConnected
        }
        
        let batchPayment = BatchPayment(
            id: UUID().uuidString,
            fromAddress: wallet.address,
            recipients: recipients,
            chain: chain.rawValue,
            createdAt: Date(),
            status: .pending,
            transactionHash: nil
        )
        
        return batchPayment
    }
    
    func submitBatchPayment(_ payment: BatchPayment) async throws -> String {
        // 使用Web3提交批量支付
        let txHash = try await web3Manager.submitBatchTransfer(
            tokenAddress: getTokenAddress(payment.recipients.first?.token ?? "USDC"),
            recipients: payment.recipients,
            chain: BlockchainChain(rawValue: payment.chain) ?? .ethereum
        )
        
        // 保存到后端
        var updatedPayment = payment
        updatedPayment.transactionHash = txHash
        updatedPayment.status = .pending
        
        let result = try await apiClient.submitBatchPayment(updatedPayment)
        return result.transactionHash ?? txHash
    }
    
    // MARK: - Payment Link
    func createPaymentLink(
        recipient: String,
        amount: Decimal,
        token: String,
        expiresIn: TimeInterval = 86400 // 24小时
    ) async throws -> PaymentLink {
        let expiresAt = Date().addingTimeInterval(expiresIn)
        
        // 生成签名
        let signature = try await generatePaymentLinkSignature(
            recipient: recipient,
            amount: amount,
            token: token,
            expiresAt: expiresAt
        )
        
        // 创建支付链接
        let link = try await apiClient.createPaymentLink(
            recipient: recipient,
            amount: amount,
            token: token
        )
        
        return link
    }
    
    func verifyPaymentLink(_ linkId: String) async throws -> PaymentLink {
        return try await apiClient.verifyPaymentLink(id: linkId)
    }
    
    // MARK: - Transaction Management
    func getTransactionHistory(
        walletAddress: String,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> [Transaction] {
        return try await apiClient.fetchTransactions(
            walletAddress: walletAddress,
            limit: limit,
            offset: offset
        )
    }
    
    func getTransactionDetails(_ hash: String) async throws -> Transaction {
        return try await apiClient.fetchTransaction(hash: hash)
    }
    
    // MARK: - Private Methods
    private func generatePaymentLinkSignature(
        recipient: String,
        amount: Decimal,
        token: String,
        expiresAt: Date
    ) async throws -> String {
        guard let wallet = walletManager.currentWallet else {
            throw PaymentError.walletNotConnected
        }
        
        let message = "\\(recipient)\\(amount)\\(token)\\(expiresAt.timeIntervalSince1970)"
        return try await web3Manager.signMessage(message)
    }
    
    private func getTokenAddress(_ symbol: String) -> String {
        switch symbol {
        case "USDC":
            return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        case "USDT":
            return "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        case "DAI":
            return "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        default:
            return ""
        }
    }
}

// MARK: - Analytics Service
class AnalyticsService {
    static let shared = AnalyticsService()
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    // MARK: - Financial Metrics
    func getFinancialMetrics() async throws -> FinancialMetrics {
        guard let wallet = walletManager.currentWallet else {
            throw AnalyticsError.walletNotConnected
        }
        
        return try await apiClient.fetchFinancialMetrics(walletAddress: wallet.address)
    }
    
    // MARK: - Payment Trends
    func getPaymentTrends(days: Int = 7) async throws -> [PaymentTrend] {
        guard let wallet = walletManager.currentWallet else {
            throw AnalyticsError.walletNotConnected
        }
        
        return try await apiClient.fetchPaymentTrends(
            walletAddress: wallet.address,
            days: days
        )
    }
    
    // MARK: - Network Graph
    func getNetworkGraph() async throws -> NetworkGraphData {
        guard let wallet = walletManager.currentWallet else {
            throw AnalyticsError.walletNotConnected
        }
        
        return try await apiClient.fetchNetworkGraph(walletAddress: wallet.address)
    }
    
    // MARK: - Analytics Calculations
    func calculateBurnRate(transactions: [Transaction]) -> Decimal {
        let calendar = Calendar.current
        let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: Date())!
        
        let monthlyTransactions = transactions.filter { $0.timestamp > thirtyDaysAgo }
        let totalBurned = monthlyTransactions.reduce(0) { $0 + $1.amount }
        
        return totalBurned
    }
    
    func calculateRunway(
        monthlyBurnRate: Decimal,
        currentBalance: Decimal
    ) -> Double {
        guard monthlyBurnRate > 0 else { return Double.infinity }
        return Double(currentBalance / monthlyBurnRate)
    }
    
    func calculateAverageTransaction(transactions: [Transaction]) -> Decimal {
        guard !transactions.isEmpty else { return 0 }
        let total = transactions.reduce(0) { $0 + $1.amount }
        return total / Decimal(transactions.count)
    }
    
    func groupTransactionsByCategory(transactions: [Transaction]) -> [String: Decimal] {
        var grouped: [String: Decimal] = [:]
        
        for transaction in transactions {
            let category = transaction.category ?? "Uncategorized"
            grouped[category, default: 0] += transaction.amount
        }
        
        return grouped
    }
}

// MARK: - Entity Management Service
class EntityService {
    static let shared = EntityService()
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    // MARK: - Entity Operations
    func getEntities() async throws -> [Entity] {
        guard let wallet = walletManager.currentWallet else {
            throw EntityError.walletNotConnected
        }
        
        return try await apiClient.fetchEntities(walletAddress: wallet.address)
    }
    
    func createEntity(
        name: String,
        address: String,
        category: EntityCategory
    ) async throws -> Entity {
        let entity = Entity(
            id: UUID().uuidString,
            name: name,
            address: address,
            category: category,
            totalPaid: 0,
            transactionCount: 0,
            healthScore: 100,
            lastTransactionDate: nil
        )
        
        return try await apiClient.createEntity(entity)
    }
    
    func updateEntity(_ entity: Entity) async throws -> Entity {
        return try await apiClient.updateEntity(entity)
    }
    
    func deleteEntity(_ entity: Entity) async throws {
        try await apiClient.deleteEntity(id: entity.id)
    }
    
    // MARK: - Entity Analytics
    func calculateEntityHealthScore(
        entity: Entity,
        transactions: [Transaction]
    ) -> Double {
        let entityTransactions = transactions.filter { $0.to == entity.address }
        
        guard !entityTransactions.isEmpty else { return 100 }
        
        // 基于交易成功率计算健康分数
        let successfulTransactions = entityTransactions.filter { $0.status == .completed || $0.status == .confirmed }
        let successRate = Double(successfulTransactions.count) / Double(entityTransactions.count)
        
        return successRate * 100
    }
    
    func getEntityTotalPaid(entity: Entity, transactions: [Transaction]) -> Decimal {
        return transactions
            .filter { $0.to == entity.address }
            .reduce(0) { $0 + $1.amount }
    }
}

// MARK: - Notification Service
class NotificationService {
    static let shared = NotificationService()
    
    @Published var notifications: [AppNotification] = []
    
    func addNotification(
        title: String,
        message: String,
        type: NotificationType,
        action: (() -> Void)? = nil
    ) {
        let notification = AppNotification(
            id: UUID().uuidString,
            title: title,
            message: message,
            type: type,
            timestamp: Date(),
            action: action
        )
        
        notifications.append(notification)
        
        // 3秒后自动移除
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            self.notifications.removeAll { $0.id == notification.id }
        }
    }
    
    func showSuccess(_ message: String) {
        addNotification(
            title: "Success",
            message: message,
            type: .success
        )
    }
    
    func showError(_ message: String) {
        addNotification(
            title: "Error",
            message: message,
            type: .error
        )
    }
    
    func showWarning(_ message: String) {
        addNotification(
            title: "Warning",
            message: message,
            type: .warning
        )
    }
    
    func showInfo(_ message: String) {
        addNotification(
            title: "Info",
            message: message,
            type: .info
        )
    }
}

// MARK: - App Notification
struct AppNotification: Identifiable {
    let id: String
    let title: String
    let message: String
    let type: NotificationType
    let timestamp: Date
    let action: (() -> Void)?
}

enum NotificationType {
    case success
    case error
    case warning
    case info
}

// MARK: - Error Types
enum PaymentError: LocalizedError {
    case walletNotConnected
    case invalidRecipient
    case insufficientBalance
    case transactionFailed
    case invalidAmount
    
    var errorDescription: String? {
        switch self {
        case .walletNotConnected:
            return "Wallet is not connected"
        case .invalidRecipient:
            return "Invalid recipient address"
        case .insufficientBalance:
            return "Insufficient balance"
        case .transactionFailed:
            return "Transaction failed"
        case .invalidAmount:
            return "Invalid amount"
        }
    }
}

enum AnalyticsError: LocalizedError {
    case walletNotConnected
    case dataUnavailable
    
    var errorDescription: String? {
        switch self {
        case .walletNotConnected:
            return "Wallet is not connected"
        case .dataUnavailable:
            return "Analytics data is unavailable"
        }
    }
}

enum EntityError: LocalizedError {
    case walletNotConnected
    case entityNotFound
    case invalidEntity
    
    var errorDescription: String? {
        switch self {
        case .walletNotConnected:
            return "Wallet is not connected"
        case .entityNotFound:
            return "Entity not found"
        case .invalidEntity:
            return "Invalid entity"
        }
    }
}
