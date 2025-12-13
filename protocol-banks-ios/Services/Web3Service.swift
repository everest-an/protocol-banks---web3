import Foundation
import Combine

// MARK: - Web3 Manager
class Web3Manager: ObservableObject {
    static let shared = Web3Manager()
    
    @Published var isConnected: Bool = false
    @Published var currentChain: BlockchainChain = .ethereum
    @Published var errorMessage: String?
    
    private let erc20Service = ERC20Service()
    private let erc3009Service = ERC3009Service()
    private let walletManager = WalletManager.shared
    
    // MARK: - Balance Operations
    func getTokenBalance(
        tokenAddress: String,
        walletAddress: String,
        chain: BlockchainChain
    ) async throws -> Decimal {
        return try await erc20Service.getBalance(
            tokenAddress: tokenAddress,
            walletAddress: walletAddress,
            chain: chain
        )
    }
    
    func getAllTokenBalances(
        walletAddress: String,
        chain: BlockchainChain
    ) async throws -> [TokenBalance] {
        return try await erc20Service.getAllBalances(
            walletAddress: walletAddress,
            chain: chain
        )
    }
    
    // MARK: - Transfer Operations
    func transferToken(
        tokenAddress: String,
        to: String,
        amount: Decimal,
        chain: BlockchainChain
    ) async throws -> String {
        return try await erc20Service.transfer(
            tokenAddress: tokenAddress,
            to: to,
            amount: amount,
            chain: chain
        )
    }
    
    // MARK: - ERC-3009 Operations
    func transferWithAuthorization(
        tokenAddress: String,
        from: String,
        to: String,
        amount: Decimal,
        validAfter: UInt32,
        validBefore: UInt32,
        nonce: String,
        signature: String,
        chain: BlockchainChain
    ) async throws -> String {
        return try await erc3009Service.transferWithAuthorization(
            tokenAddress: tokenAddress,
            from: from,
            to: to,
            amount: amount,
            validAfter: validAfter,
            validBefore: validBefore,
            nonce: nonce,
            signature: signature,
            chain: chain
        )
    }
    
    func getAuthorizationState(
        tokenAddress: String,
        authorizer: String,
        nonce: String,
        chain: BlockchainChain
    ) async throws -> Bool {
        return try await erc3009Service.getAuthorizationState(
            tokenAddress: tokenAddress,
            authorizer: authorizer,
            nonce: nonce,
            chain: chain
        )
    }
    
    // MARK: - Signature Operations
    func signMessage(_ message: String) async throws -> String {
        return try await walletManager.signMessage(message)
    }
    
    func signTypedData(
        domain: EIP712Domain,
        types: [String: [EIP712Type]],
        value: [String: Any]
    ) async throws -> String {
        // 实现EIP-712签名
        // 这是一个模拟实现
        let messageHash = hashTypedData(domain: domain, types: types, value: value)
        return try await signMessage(messageHash)
    }
    
    // MARK: - Batch Operations
    func submitBatchTransfer(
        tokenAddress: String,
        recipients: [PaymentRecipient],
        chain: BlockchainChain
    ) async throws -> String {
        return try await erc20Service.batchTransfer(
            tokenAddress: tokenAddress,
            recipients: recipients,
            chain: chain
        )
    }
    
    // MARK: - Private Methods
    private func hashTypedData(
        domain: EIP712Domain,
        types: [String: [EIP712Type]],
        value: [String: Any]
    ) -> String {
        // 实现EIP-712哈希计算
        // 这是一个模拟实现
        return "0x" + String(repeating: "0", count: 64)
    }
}

// MARK: - ERC-20 Service
class ERC20Service {
    private let rpcManager = RPCManager.shared
    
    // ERC-20 ABI
    private let erc20ABI = """
    [
        {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [
                {"name": "_to", "type": "address"},
                {"name": "_value", "type": "uint256"}
            ],
            "name": "transfer",
            "outputs": [{"name": "", "type": "bool"}],
            "type": "function"
        }
    ]
    """
    
    func getBalance(
        tokenAddress: String,
        walletAddress: String,
        chain: BlockchainChain
    ) async throws -> Decimal {
        let rpcUrl = chain.rpcUrl
        
        // 构建balanceOf调用数据
        let methodId = "0x70a08231" // balanceOf方法ID
        let paddedAddress = String(format: "%064s", walletAddress.dropFirst(2)).replacingOccurrences(of: " ", with: "0")
        let callData = methodId + paddedAddress
        
        let result = try await rpcManager.call(
            to: tokenAddress,
            data: callData,
            chain: chain
        )
        
        // 解析结果
        if let value = BigInt(result.dropFirst(2), radix: 16) {
            return Decimal(value) / Decimal(pow(10, 18))
        }
        
        return 0
    }
    
    func getAllBalances(
        walletAddress: String,
        chain: BlockchainChain
    ) async throws -> [TokenBalance] {
        // 实际实现中应该查询多个代币
        // 这里返回模拟数据
        let tokens = [
            ("USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6),
            ("USDT", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 6),
            ("DAI", "0x6B175474E89094C44Da98b954EedeAC495271d0F", 18)
        ]
        
        var balances: [TokenBalance] = []
        
        for (symbol, address, decimals) in tokens {
            do {
                let balance = try await getBalance(
                    tokenAddress: address,
                    walletAddress: walletAddress,
                    chain: chain
                )
                
                balances.append(TokenBalance(
                    id: UUID().uuidString,
                    symbol: symbol,
                    name: symbol,
                    decimals: decimals,
                    balance: balance,
                    contractAddress: address,
                    logoUrl: nil
                ))
            } catch {
                print("Failed to fetch balance for \\(symbol): \\(error)")
            }
        }
        
        return balances
    }
    
    func transfer(
        tokenAddress: String,
        to: String,
        amount: Decimal,
        chain: BlockchainChain
    ) async throws -> String {
        // 实现ERC-20转账
        // 需要钱包签名
        let methodId = "0xa9059cbb" // transfer方法ID
        let paddedTo = String(format: "%064s", to.dropFirst(2)).replacingOccurrences(of: " ", with: "0")
        let amountWei = String(format: "%064x", UInt256(amount) * UInt256(pow(10, 18)))
        let callData = methodId + paddedTo + amountWei
        
        // 这里应该使用WalletConnect进行签名和发送
        let txHash = try await rpcManager.sendTransaction(
            to: tokenAddress,
            data: callData,
            chain: chain
        )
        
        return txHash
    }
    
    func batchTransfer(
        tokenAddress: String,
        recipients: [PaymentRecipient],
        chain: BlockchainChain
    ) async throws -> String {
        // 实现批量转账
        // 可以使用批量转账合约或多个单独的转账
        var txHashes: [String] = []
        
        for recipient in recipients {
            let txHash = try await transfer(
                tokenAddress: tokenAddress,
                to: recipient.address,
                amount: recipient.amount,
                chain: chain
            )
            txHashes.append(txHash)
        }
        
        // 返回第一个交易哈希
        return txHashes.first ?? ""
    }
}

// MARK: - ERC-3009 Service
class ERC3009Service {
    private let rpcManager = RPCManager.shared
    
    func transferWithAuthorization(
        tokenAddress: String,
        from: String,
        to: String,
        amount: Decimal,
        validAfter: UInt32,
        validBefore: UInt32,
        nonce: String,
        signature: String,
        chain: BlockchainChain
    ) async throws -> String {
        // 实现ERC-3009 transferWithAuthorization
        let methodId = "0x7ecebe00" // transferWithAuthorization方法ID
        
        // 构建调用数据
        var callData = methodId
        callData += String(format: "%064s", from.dropFirst(2)).replacingOccurrences(of: " ", with: "0")
        callData += String(format: "%064s", to.dropFirst(2)).replacingOccurrences(of: " ", with: "0")
        callData += String(format: "%064x", UInt256(amount))
        callData += String(format: "%08x", validAfter)
        callData += String(format: "%08x", validBefore)
        callData += nonce
        callData += signature.dropFirst(2)
        
        let txHash = try await rpcManager.sendTransaction(
            to: tokenAddress,
            data: callData,
            chain: chain
        )
        
        return txHash
    }
    
    func getAuthorizationState(
        tokenAddress: String,
        authorizer: String,
        nonce: String,
        chain: BlockchainChain
    ) async throws -> Bool {
        // 查询授权状态
        let methodId = "0x7c0f3e02" // authorizationState方法ID
        let paddedAuthorizer = String(format: "%064s", authorizer.dropFirst(2)).replacingOccurrences(of: " ", with: "0")
        let callData = methodId + paddedAuthorizer + nonce
        
        let result = try await rpcManager.call(
            to: tokenAddress,
            data: callData,
            chain: chain
        )
        
        return result != "0x0"
    }
}

// MARK: - RPC Manager
class RPCManager {
    static let shared = RPCManager()
    
    private let session: URLSession
    
    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }
    
    func call(
        to: String,
        data: String,
        chain: BlockchainChain
    ) async throws -> String {
        let rpcUrl = chain.rpcUrl
        let requestBody: [String: Any] = [
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                ["to": to, "data": data],
                "latest"
            ],
            "id": 1
        ]
        
        let result = try await sendRPCRequest(url: rpcUrl, body: requestBody)
        return result
    }
    
    func sendTransaction(
        to: String,
        data: String,
        chain: BlockchainChain
    ) async throws -> String {
        // 实际实现中应该使用WalletConnect进行签名
        // 这里返回模拟的交易哈希
        return "0x" + String(repeating: "0", count: 64)
    }
    
    private func sendRPCRequest(
        url: String,
        body: [String: Any]
    ) async throws -> String {
        guard let requestUrl = URL(string: url) else {
            throw Web3Error.invalidURL
        }
        
        var request = URLRequest(url: requestUrl)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await session.data(for: request)
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let result = json["result"] as? String {
            return result
        }
        
        throw Web3Error.invalidResponse
    }
}

// MARK: - EIP-712 Types
struct EIP712Domain {
    let name: String
    let version: String
    let chainId: Int
    let verifyingContract: String
}

struct EIP712Type {
    let name: String
    let type: String
}

// MARK: - Web3 Error
enum Web3Error: LocalizedError {
    case invalidURL
    case invalidResponse
    case invalidSignature
    case transactionFailed
    case insufficientBalance
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid RPC response"
        case .invalidSignature:
            return "Invalid signature"
        case .transactionFailed:
            return "Transaction failed"
        case .insufficientBalance:
            return "Insufficient balance"
        case .networkError(let error):
            return "Network error: \\(error.localizedDescription)"
        }
    }
}

// MARK: - BigInt Helper
typealias BigInt = Int
typealias UInt256 = UInt64
