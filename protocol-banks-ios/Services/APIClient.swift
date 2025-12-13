import Foundation
import Combine

class APIClient {
    static let shared = APIClient()
    
    private let baseURL = "https://api.protocolbanks.com"
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    
    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
        
        // 配置JSON编码器/解码器
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }
    
    // MARK: - User Endpoints
    func fetchUser(walletAddress: String) async throws -> User {
        let endpoint = "/users/\\(walletAddress)"
        return try await request(endpoint, method: .get)
    }
    
    func updateUser(_ user: User) async throws -> User {
        let endpoint = "/users/\\(user.id)"
        return try await request(endpoint, method: .put, body: user)
    }
    
    func createUser(_ user: User) async throws -> User {
        let endpoint = "/users"
        return try await request(endpoint, method: .post, body: user)
    }
    
    // MARK: - Transaction Endpoints
    func fetchTransactions(walletAddress: String, limit: Int = 50, offset: Int = 0) async throws -> [Transaction] {
        let endpoint = "/transactions?wallet=\\(walletAddress)&limit=\\(limit)&offset=\\(offset)"
        let response: APIResponse<[Transaction]> = try await request(endpoint, method: .get)
        return response.data ?? []
    }
    
    func fetchTransaction(hash: String) async throws -> Transaction {
        let endpoint = "/transactions/\\(hash)"
        return try await request(endpoint, method: .get)
    }
    
    func submitTransaction(_ transaction: Transaction) async throws -> Transaction {
        let endpoint = "/transactions"
        return try await request(endpoint, method: .post, body: transaction)
    }
    
    // MARK: - Entity Endpoints
    func fetchEntities(walletAddress: String) async throws -> [Entity] {
        let endpoint = "/entities?wallet=\\(walletAddress)"
        let response: APIResponse<[Entity]> = try await request(endpoint, method: .get)
        return response.data ?? []
    }
    
    func createEntity(_ entity: Entity) async throws -> Entity {
        let endpoint = "/entities"
        return try await request(endpoint, method: .post, body: entity)
    }
    
    func updateEntity(_ entity: Entity) async throws -> Entity {
        let endpoint = "/entities/\\(entity.id)"
        return try await request(endpoint, method: .put, body: entity)
    }
    
    func deleteEntity(id: String) async throws {
        let endpoint = "/entities/\\(id)"
        _ = try await request(endpoint, method: .delete) as EmptyResponse
    }
    
    // MARK: - Payment Link Endpoints
    func createPaymentLink(recipient: String, amount: Decimal, token: String) async throws -> PaymentLink {
        let endpoint = "/payment-links"
        let payload: [String: Any] = [
            "recipient_address": recipient,
            "amount": amount.description,
            "token": token
        ]
        return try await request(endpoint, method: .post, body: payload)
    }
    
    func fetchPaymentLinks(walletAddress: String) async throws -> [PaymentLink] {
        let endpoint = "/payment-links?wallet=\\(walletAddress)"
        let response: APIResponse<[PaymentLink]> = try await request(endpoint, method: .get)
        return response.data ?? []
    }
    
    func verifyPaymentLink(id: String) async throws -> PaymentLink {
        let endpoint = "/payment-links/\\(id)/verify"
        return try await request(endpoint, method: .get)
    }
    
    // MARK: - Analytics Endpoints
    func fetchFinancialMetrics(walletAddress: String) async throws -> FinancialMetrics {
        let endpoint = "/analytics/metrics?wallet=\\(walletAddress)"
        return try await request(endpoint, method: .get)
    }
    
    func fetchPaymentTrends(walletAddress: String, days: Int = 7) async throws -> [PaymentTrend] {
        let endpoint = "/analytics/trends?wallet=\\(walletAddress)&days=\\(days)"
        let response: APIResponse<[PaymentTrend]> = try await request(endpoint, method: .get)
        return response.data ?? []
    }
    
    func fetchNetworkGraph(walletAddress: String) async throws -> NetworkGraphData {
        let endpoint = "/analytics/network?wallet=\\(walletAddress)"
        return try await request(endpoint, method: .get)
    }
    
    // MARK: - Batch Payment Endpoints
    func submitBatchPayment(_ payment: BatchPayment) async throws -> BatchPayment {
        let endpoint = "/batch-payments"
        return try await request(endpoint, method: .post, body: payment)
    }
    
    func fetchBatchPayments(walletAddress: String) async throws -> [BatchPayment] {
        let endpoint = "/batch-payments?wallet=\\(walletAddress)"
        let response: APIResponse<[BatchPayment]> = try await request(endpoint, method: .get)
        return response.data ?? []
    }
    
    // MARK: - Generic Request Method
    private func request<T: Decodable>(
        _ endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil
    ) async throws -> T {
        let url = URL(string: baseURL + endpoint)!
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // 设置通用headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // 添加认证token (如果有)
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        }
        
        // 编码请求体
        if let body = body {
            if let dict = body as? [String: Any] {
                request.httpBody = try JSONSerialization.data(withJSONObject: dict)
            } else {
                request.httpBody = try encoder.encode(body)
            }
        }
        
        let (data, response) = try await session.data(for: request)
        
        // 检查HTTP状态码
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        // 解码响应
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - HTTP Method
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

// MARK: - API Error
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case decodingError(Error)
    case networkError(Error)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP Error \\(code)"
        case .decodingError:
            return "Failed to decode response"
        case .networkError(let error):
            return "Network error: \\(error.localizedDescription)"
        case .unknown:
            return "Unknown error occurred"
        }
    }
}

// MARK: - Empty Response
struct EmptyResponse: Codable {}
