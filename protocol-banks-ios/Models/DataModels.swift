import Foundation

// MARK: - User
struct User: Codable, Identifiable {
    let id: String
    let walletAddress: String
    var name: String
    var email: String?
    let createdAt: Date
    var updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id, name, email
        case walletAddress = "wallet_address"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Wallet
struct Wallet: Codable, Identifiable {
    let id: String
    let address: String
    let chainId: Int
    var balance: Decimal
    var tokenBalances: [TokenBalance]
    var isConnected: Bool
    let lastUpdated: Date
    
    enum CodingKeys: String, CodingKey {
        case id, address, balance
        case chainId = "chain_id"
        case tokenBalances = "token_balances"
        case isConnected = "is_connected"
        case lastUpdated = "last_updated"
    }
}

// MARK: - Token Balance
struct TokenBalance: Codable, Identifiable {
    let id: String
    let symbol: String
    let name: String
    let decimals: Int
    var balance: Decimal
    let contractAddress: String?
    let logoUrl: String?
    
    enum CodingKeys: String, CodingKey {
        case id, symbol, name, decimals, balance
        case contractAddress = "contract_address"
        case logoUrl = "logo_url"
    }
}

// MARK: - Transaction
struct Transaction: Codable, Identifiable {
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
    let gasUsed: Decimal?
    let gasPrice: Decimal?
    
    enum CodingKeys: String, CodingKey {
        case id, hash, from, to, amount, token, chain, status, timestamp, category, notes
        case gasUsed = "gas_used"
        case gasPrice = "gas_price"
    }
}

// MARK: - Transaction Status
enum TransactionStatus: String, Codable {
    case pending
    case completed
    case failed
    case confirmed
}

// MARK: - Entity (Wallet Tag)
struct Entity: Codable, Identifiable {
    let id: String
    var name: String
    let address: String
    let category: EntityCategory
    var totalPaid: Decimal
    var transactionCount: Int
    var healthScore: Double
    var lastTransactionDate: Date?
    
    enum CodingKeys: String, CodingKey {
        case id, name, address, category
        case totalPaid = "total_paid"
        case transactionCount = "transaction_count"
        case healthScore = "health_score"
        case lastTransactionDate = "last_transaction_date"
    }
}

// MARK: - Entity Category
enum EntityCategory: String, Codable {
    case supplier = "Supplier"
    case partner = "Partner"
    case subsidiary = "Subsidiary"
    case other = "Other"
}

// MARK: - Payment Link
struct PaymentLink: Codable, Identifiable {
    let id: String
    let recipientAddress: String
    let amount: Decimal
    let token: String
    let chain: String
    let expiresAt: Date
    let signature: String
    var isUsed: Bool
    let createdAt: Date
    let shareableUrl: String?
    
    enum CodingKeys: String, CodingKey {
        case id, amount, token, chain, signature
        case recipientAddress = "recipient_address"
        case expiresAt = "expires_at"
        case isUsed = "is_used"
        case createdAt = "created_at"
        case shareableUrl = "shareable_url"
    }
}

// MARK: - Batch Payment
struct BatchPayment: Codable, Identifiable {
    let id: String
    let fromAddress: String
    var recipients: [PaymentRecipient]
    let chain: String
    let createdAt: Date
    var status: TransactionStatus
    var transactionHash: String?
    
    enum CodingKeys: String, CodingKey {
        case id, recipients, chain, status
        case fromAddress = "from_address"
        case createdAt = "created_at"
        case transactionHash = "transaction_hash"
    }
}

// MARK: - Payment Recipient
struct PaymentRecipient: Codable, Identifiable {
    let id: String
    let address: String
    let amount: Decimal
    let token: String
    var entityName: String?
    
    enum CodingKeys: String, CodingKey {
        case id, address, amount, token
        case entityName = "entity_name"
    }
}

// MARK: - Financial Metrics
struct FinancialMetrics: Codable {
    let totalSent: Decimal
    let transactionCount: Int
    let walletTagCount: Int
    let thisWeekPayments: Int
    let monthlyBurnRate: Decimal
    let estimatedRunway: Double
    let topExpenseCategory: String?
    let topExpenseCategoryAmount: Decimal?
    let averageTransaction: Decimal
    
    enum CodingKeys: String, CodingKey {
        case totalSent = "total_sent"
        case transactionCount = "transaction_count"
        case walletTagCount = "wallet_tag_count"
        case thisWeekPayments = "this_week_payments"
        case monthlyBurnRate = "monthly_burn_rate"
        case estimatedRunway = "estimated_runway"
        case topExpenseCategory = "top_expense_category"
        case topExpenseCategoryAmount = "top_expense_category_amount"
        case averageTransaction = "average_transaction"
    }
}

// MARK: - Payment Trend
struct PaymentTrend: Codable, Identifiable {
    let id: String
    let date: Date
    let amount: Decimal
    let transactionCount: Int
    
    enum CodingKeys: String, CodingKey {
        case id, date, amount
        case transactionCount = "transaction_count"
    }
}

// MARK: - Network Graph Data
struct NetworkGraphData: Codable {
    let nodes: [NetworkNode]
    let links: [NetworkLink]
    let statistics: NetworkStatistics
}

struct NetworkNode: Codable, Identifiable {
    let id: String
    var name: String
    let address: String
    let category: EntityCategory
    var size: Double
    var color: String
}

struct NetworkLink: Codable, Identifiable {
    let id: String
    let source: String
    let target: String
    let value: Decimal
    let transactionCount: Int
}

struct NetworkStatistics: Codable {
    let nodeCount: Int
    let linkCount: Int
    let totalFlow: Decimal
    let activeEntities: Int
    let averageTransaction: Decimal
    let healthScore: Double
    
    enum CodingKeys: String, CodingKey {
        case nodeCount = "node_count"
        case linkCount = "link_count"
        case totalFlow = "total_flow"
        case activeEntities = "active_entities"
        case averageTransaction = "average_transaction"
        case healthScore = "health_score"
    }
}

// MARK: - API Response Wrapper
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
    let message: String?
}

// MARK: - Blockchain Chain
enum BlockchainChain: String, Codable, CaseIterable {
    case ethereum = "Ethereum"
    case base = "Base"
    case polygon = "Polygon"
    case arbitrum = "Arbitrum"
    case optimism = "Optimism"
    case solana = "Solana"
    case bitcoin = "Bitcoin"
    
    var chainId: Int? {
        switch self {
        case .ethereum: return 1
        case .base: return 8453
        case .polygon: return 137
        case .arbitrum: return 42161
        case .optimism: return 10
        case .solana: return nil
        case .bitcoin: return nil
        }
    }
    
    var rpcUrl: String {
        switch self {
        case .ethereum:
            return "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
        case .base:
            return "https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
        case .polygon:
            return "https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
        case .arbitrum:
            return "https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
        case .optimism:
            return "https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
        case .solana:
            return "https://api.mainnet-beta.solana.com"
        case .bitcoin:
            return "https://blockstream.info/api"
        }
    }
}

// MARK: - Token
struct Token: Codable, Identifiable {
    let id: String
    let symbol: String
    let name: String
    let decimals: Int
    let contractAddress: String?
    let chain: BlockchainChain
    let logoUrl: String?
    
    enum CodingKeys: String, CodingKey {
        case id, symbol, name, decimals, chain
        case contractAddress = "contract_address"
        case logoUrl = "logo_url"
    }
}
