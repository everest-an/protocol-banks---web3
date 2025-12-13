import Foundation
import Combine

class WalletManager: NSObject, ObservableObject {
    static let shared = WalletManager()
    
    @Published var isConnected: Bool = false
    @Published var currentWallet: Wallet?
    @Published var currentUser: User?
    @Published var wallets: [Wallet] = []
    @Published var selectedChain: BlockchainChain = .ethereum
    @Published var isConnecting: Bool = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let walletConnectService = WalletConnectService()
    private let keychainManager = KeychainManager.shared
    private let storageManager = StorageManager.shared
    
    override init() {
        super.init()
        setupBindings()
        loadStoredWallet()
    }
    
    // MARK: - Setup
    private func setupBindings() {
        // 监听钱包连接状态变化
        walletConnectService.connectionStatusPublisher
            .receive(on: DispatchQueue.main)
            .assign(to: &$isConnected)
    }
    
    private func loadStoredWallet() {
        if let storedWallet = storageManager.loadWallet() {
            self.currentWallet = storedWallet
            self.isConnected = true
        }
    }
    
    // MARK: - Wallet Connection
    func connectWallet() {
        isConnecting = true
        errorMessage = nil
        
        Task {
            do {
                let walletInfo = try await walletConnectService.connect()
                
                await MainActor.run {
                    self.currentWallet = walletInfo
                    self.isConnected = true
                    self.isConnecting = false
                    
                    // 保存钱包信息
                    self.storageManager.saveWallet(walletInfo)
                    
                    // 获取用户信息
                    self.fetchUserInfo(walletAddress: walletInfo.address)
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isConnecting = false
                }
            }
        }
    }
    
    func disconnectWallet() {
        walletConnectService.disconnect()
        currentWallet = nil
        currentUser = nil
        wallets = []
        isConnected = false
        storageManager.clearWallet()
    }
    
    func switchWallet(_ wallet: Wallet) {
        currentWallet = wallet
        selectedChain = BlockchainChain(rawValue: wallet.chain) ?? .ethereum
        storageManager.saveWallet(wallet)
    }
    
    func switchChain(_ chain: BlockchainChain) {
        selectedChain = chain
    }
    
    // MARK: - Balance Management
    func refreshBalance() {
        guard let wallet = currentWallet else { return }
        
        Task {
            do {
                let updatedWallet = try await walletConnectService.fetchBalance(for: wallet.address)
                
                await MainActor.run {
                    self.currentWallet = updatedWallet
                    self.storageManager.saveWallet(updatedWallet)
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    // MARK: - User Management
    private func fetchUserInfo(walletAddress: String) {
        Task {
            do {
                let user = try await APIClient.shared.fetchUser(walletAddress: walletAddress)
                
                await MainActor.run {
                    self.currentUser = user
                    self.storageManager.saveUser(user)
                }
            } catch {
                // 如果用户不存在，创建新用户
                let newUser = User(
                    id: UUID().uuidString,
                    walletAddress: walletAddress,
                    name: "",
                    email: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
                
                await MainActor.run {
                    self.currentUser = newUser
                    self.storageManager.saveUser(newUser)
                }
            }
        }
    }
    
    func updateUserProfile(name: String, email: String?) {
        guard var user = currentUser else { return }
        
        user.name = name
        user.email = email
        user.updatedAt = Date()
        
        Task {
            do {
                let updatedUser = try await APIClient.shared.updateUser(user)
                
                await MainActor.run {
                    self.currentUser = updatedUser
                    self.storageManager.saveUser(updatedUser)
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    // MARK: - Transaction Signing
    func signMessage(_ message: String) async throws -> String {
        return try await walletConnectService.signMessage(message)
    }
    
    func signTransaction(_ transaction: [String: Any]) async throws -> String {
        return try await walletConnectService.signTransaction(transaction)
    }
}

// MARK: - WalletConnect Service
class WalletConnectService: NSObject, ObservableObject {
    @Published var connectionStatus: WalletConnectionStatus = .disconnected
    
    var connectionStatusPublisher: AnyPublisher<Bool, Never> {
        $connectionStatus
            .map { $0 == .connected }
            .eraseToAnyPublisher()
    }
    
    private var cancellables = Set<AnyCancellable>()
    
    // 模拟WalletConnect连接
    func connect() async throws -> Wallet {
        // 实际实现中应该使用WalletConnect SDK
        // 这里是模拟实现
        
        await MainActor.run {
            self.connectionStatus = .connecting
        }
        
        try await Task.sleep(nanoseconds: 2_000_000_000) // 2秒延迟
        
        let mockWallet = Wallet(
            id: UUID().uuidString,
            address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            chainId: 1,
            balance: Decimal(string: "10.5") ?? 0,
            tokenBalances: [
                TokenBalance(
                    id: UUID().uuidString,
                    symbol: "USDC",
                    name: "USD Coin",
                    decimals: 6,
                    balance: Decimal(string: "15500.00") ?? 0,
                    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    logoUrl: "https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png"
                ),
                TokenBalance(
                    id: UUID().uuidString,
                    symbol: "USDT",
                    name: "Tether USD",
                    decimals: 6,
                    balance: Decimal(string: "10000.00") ?? 0,
                    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    logoUrl: "https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png"
                ),
                TokenBalance(
                    id: UUID().uuidString,
                    symbol: "DAI",
                    name: "Dai Stablecoin",
                    decimals: 18,
                    balance: Decimal(string: "5000.00") ?? 0,
                    contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                    logoUrl: "https://tokens.1inch.io/0x6b175474e89094c44da98b954eedeac495271d0f.png"
                ),
            ],
            isConnected: true,
            lastUpdated: Date()
        )
        
        await MainActor.run {
            self.connectionStatus = .connected
        }
        
        return mockWallet
    }
    
    func disconnect() {
        connectionStatus = .disconnected
    }
    
    func fetchBalance(for address: String) async throws -> Wallet {
        // 实际实现中应该调用区块链RPC
        // 这里返回模拟数据
        
        try await Task.sleep(nanoseconds: 1_000_000_000) // 1秒延迟
        
        return Wallet(
            id: UUID().uuidString,
            address: address,
            chainId: 1,
            balance: Decimal(string: "10.5") ?? 0,
            tokenBalances: [],
            isConnected: true,
            lastUpdated: Date()
        )
    }
    
    func signMessage(_ message: String) async throws -> String {
        // 实际实现中应该使用WalletConnect签名
        try await Task.sleep(nanoseconds: 1_000_000_000)
        return "0x" + String(repeating: "0", count: 130)
    }
    
    func signTransaction(_ transaction: [String: Any]) async throws -> String {
        // 实际实现中应该使用WalletConnect签名
        try await Task.sleep(nanoseconds: 2_000_000_000)
        return "0x" + String(repeating: "0", count: 130)
    }
}

// MARK: - Connection Status
enum WalletConnectionStatus {
    case disconnected
    case connecting
    case connected
    case error(String)
}
