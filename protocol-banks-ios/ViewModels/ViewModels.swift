import Foundation
import Combine

// MARK: - Dashboard ViewModel
class DashboardViewModel: ObservableObject {
    @Published var metrics: FinancialMetrics?
    @Published var recentTransactions: [Transaction] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    func loadData() {
        guard let wallet = walletManager.currentWallet else { return }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                async let metrics = apiClient.fetchFinancialMetrics(walletAddress: wallet.address)
                async let transactions = apiClient.fetchTransactions(walletAddress: wallet.address, limit: 5)
                
                let (metricsResult, transactionsResult) = try await (metrics, transactions)
                
                await MainActor.run {
                    self.metrics = metricsResult
                    self.recentTransactions = transactionsResult
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func formatCurrency(_ value: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "$"
        return formatter.string(from: NSDecimalNumber(decimal: value)) ?? "$0.00"
    }
}

// MARK: - Batch Payment ViewModel
class BatchPaymentViewModel: ObservableObject {
    @Published var recipients: [PaymentRecipient] = [
        PaymentRecipient(id: UUID().uuidString, address: "", amount: 0, token: "USDC", entityName: nil)
    ]
    @Published var selectedChain: BlockchainChain = .ethereum
    @Published var isSubmitting: Bool = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    var totalAmount: Decimal {
        recipients.reduce(0) { $0 + $1.amount }
    }
    
    func addRecipient() {
        recipients.append(
            PaymentRecipient(
                id: UUID().uuidString,
                address: "",
                amount: 0,
                token: "USDC",
                entityName: nil
            )
        )
    }
    
    func removeRecipient(at index: Int) {
        guard recipients.count > 1 else { return }
        recipients.remove(at: index)
    }
    
    func submitPayment() {
        guard let wallet = walletManager.currentWallet else { return }
        guard !recipients.isEmpty else { return }
        
        isSubmitting = true
        errorMessage = nil
        
        let batchPayment = BatchPayment(
            id: UUID().uuidString,
            fromAddress: wallet.address,
            recipients: recipients,
            chain: selectedChain.rawValue,
            createdAt: Date(),
            status: .pending,
            transactionHash: nil
        )
        
        Task {
            do {
                let result = try await apiClient.submitBatchPayment(batchPayment)
                
                await MainActor.run {
                    self.successMessage = "Payment submitted successfully"
                    self.isSubmitting = false
                    self.resetForm()
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isSubmitting = false
                }
            }
        }
    }
    
    private func resetForm() {
        recipients = [
            PaymentRecipient(id: UUID().uuidString, address: "", amount: 0, token: "USDC", entityName: nil)
        ]
        selectedChain = .ethereum
    }
    
    func formatCurrency(_ value: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "$"
        return formatter.string(from: NSDecimalNumber(decimal: value)) ?? "$0.00"
    }
}

// MARK: - Receive Payment ViewModel
class ReceivePaymentViewModel: ObservableObject {
    @Published var recipientAddress: String = ""
    @Published var amount: String = ""
    @Published var selectedToken: String = "USDC"
    @Published var generatedLink: PaymentLink?
    @Published var isGenerating: Bool = false
    @Published var errorMessage: String?
    
    private let apiClient = APIClient.shared
    
    func generatePaymentLink() {
        guard !recipientAddress.isEmpty else {
            errorMessage = "Please enter recipient address"
            return
        }
        
        guard let amountDecimal = Decimal(string: amount), amountDecimal > 0 else {
            errorMessage = "Please enter valid amount"
            return
        }
        
        isGenerating = true
        errorMessage = nil
        
        Task {
            do {
                let link = try await apiClient.createPaymentLink(
                    recipient: recipientAddress,
                    amount: amountDecimal,
                    token: selectedToken
                )
                
                await MainActor.run {
                    self.generatedLink = link
                    self.isGenerating = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isGenerating = false
                }
            }
        }
    }
    
    func copyLink() {
        if let url = generatedLink?.shareableUrl {
            UIPasteboard.general.string = url
        }
    }
    
    func shareLink() {
        guard let url = generatedLink?.shareableUrl else { return }
        
        let activityViewController = UIActivityViewController(
            activityItems: [url],
            applicationActivities: nil
        )
        
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            scene.windows.first?.rootViewController?.present(activityViewController, animated: true)
        }
    }
}

// MARK: - Analytics ViewModel
class AnalyticsViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
    @Published var trends: [PaymentTrend] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    func loadTransactions() {
        guard let wallet = walletManager.currentWallet else { return }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                async let transactions = apiClient.fetchTransactions(walletAddress: wallet.address, limit: 100)
                async let trends = apiClient.fetchPaymentTrends(walletAddress: wallet.address, days: 30)
                
                let (transactionsResult, trendsResult) = try await (transactions, trends)
                
                await MainActor.run {
                    self.transactions = transactionsResult
                    self.trends = trendsResult
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}

// MARK: - Settings ViewModel
class SettingsViewModel: ObservableObject {
    @Published var isDarkMode: Bool = true
    @Published var notificationsEnabled: Bool = true
    @Published var biometricEnabled: Bool = false
    
    private let storageManager = StorageManager.shared
    private let keychainManager = KeychainManager.shared
    
    init() {
        loadSettings()
    }
    
    private func loadSettings() {
        isDarkMode = storageManager.loadBool(forKey: "isDarkMode") ?? true
        notificationsEnabled = storageManager.loadBool(forKey: "notificationsEnabled") ?? true
        biometricEnabled = storageManager.loadBool(forKey: "biometricEnabled") ?? false
    }
    
    func saveDarkMode(_ value: Bool) {
        isDarkMode = value
        storageManager.saveBool(value, forKey: "isDarkMode")
    }
    
    func saveNotifications(_ value: Bool) {
        notificationsEnabled = value
        storageManager.saveBool(value, forKey: "notificationsEnabled")
    }
    
    func saveBiometric(_ value: Bool) {
        biometricEnabled = value
        storageManager.saveBool(value, forKey: "biometricEnabled")
    }
}

// MARK: - Vendor Management ViewModel
class VendorManagementViewModel: ObservableObject {
    @Published var entities: [Entity] = []
    @Published var selectedEntity: Entity?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var showAddForm: Bool = false
    
    @Published var newEntityName: String = ""
    @Published var newEntityAddress: String = ""
    @Published var newEntityCategory: EntityCategory = .supplier
    
    private let apiClient = APIClient.shared
    private let walletManager = WalletManager.shared
    
    func loadEntities() {
        guard let wallet = walletManager.currentWallet else { return }
        
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let entities = try await apiClient.fetchEntities(walletAddress: wallet.address)
                
                await MainActor.run {
                    self.entities = entities
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func addEntity() {
        guard !newEntityName.isEmpty, !newEntityAddress.isEmpty else {
            errorMessage = "Please fill in all fields"
            return
        }
        
        let entity = Entity(
            id: UUID().uuidString,
            name: newEntityName,
            address: newEntityAddress,
            category: newEntityCategory,
            totalPaid: 0,
            transactionCount: 0,
            healthScore: 100,
            lastTransactionDate: nil
        )
        
        Task {
            do {
                let createdEntity = try await apiClient.createEntity(entity)
                
                await MainActor.run {
                    self.entities.append(createdEntity)
                    self.resetForm()
                    self.showAddForm = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    func updateEntity(_ entity: Entity) {
        Task {
            do {
                let updatedEntity = try await apiClient.updateEntity(entity)
                
                await MainActor.run {
                    if let index = self.entities.firstIndex(where: { $0.id == updatedEntity.id }) {
                        self.entities[index] = updatedEntity
                    }
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    func deleteEntity(_ entity: Entity) {
        Task {
            do {
                try await apiClient.deleteEntity(id: entity.id)
                
                await MainActor.run {
                    self.entities.removeAll { $0.id == entity.id }
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func resetForm() {
        newEntityName = ""
        newEntityAddress = ""
        newEntityCategory = .supplier
    }
}
