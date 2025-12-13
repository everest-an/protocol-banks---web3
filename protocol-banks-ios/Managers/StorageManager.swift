import Foundation

class StorageManager {
    static let shared = StorageManager()
    
    private let userDefaults = UserDefaults.standard
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    
    private let keychainManager = KeychainManager.shared
    
    // MARK: - Wallet Storage
    func saveWallet(_ wallet: Wallet) {
        do {
            let data = try encoder.encode(wallet)
            userDefaults.set(data, forKey: "currentWallet")
        } catch {
            print("Failed to save wallet: \\(error)")
        }
    }
    
    func loadWallet() -> Wallet? {
        guard let data = userDefaults.data(forKey: "currentWallet") else {
            return nil
        }
        
        do {
            return try decoder.decode(Wallet.self, from: data)
        } catch {
            print("Failed to load wallet: \\(error)")
            return nil
        }
    }
    
    func clearWallet() {
        userDefaults.removeObject(forKey: "currentWallet")
    }
    
    // MARK: - User Storage
    func saveUser(_ user: User) {
        do {
            let data = try encoder.encode(user)
            userDefaults.set(data, forKey: "currentUser")
        } catch {
            print("Failed to save user: \\(error)")
        }
    }
    
    func loadUser() -> User? {
        guard let data = userDefaults.data(forKey: "currentUser") else {
            return nil
        }
        
        do {
            return try decoder.decode(User.self, from: data)
        } catch {
            print("Failed to load user: \\(error)")
            return nil
        }
    }
    
    func clearUser() {
        userDefaults.removeObject(forKey: "currentUser")
    }
    
    // MARK: - Transactions Storage
    func saveTransactions(_ transactions: [Transaction]) {
        do {
            let data = try encoder.encode(transactions)
            userDefaults.set(data, forKey: "transactions")
        } catch {
            print("Failed to save transactions: \\(error)")
        }
    }
    
    func loadTransactions() -> [Transaction] {
        guard let data = userDefaults.data(forKey: "transactions") else {
            return []
        }
        
        do {
            return try decoder.decode([Transaction].self, from: data)
        } catch {
            print("Failed to load transactions: \\(error)")
            return []
        }
    }
    
    // MARK: - Entities Storage
    func saveEntities(_ entities: [Entity]) {
        do {
            let data = try encoder.encode(entities)
            userDefaults.set(data, forKey: "entities")
        } catch {
            print("Failed to save entities: \\(error)")
        }
    }
    
    func loadEntities() -> [Entity] {
        guard let data = userDefaults.data(forKey: "entities") else {
            return []
        }
        
        do {
            return try decoder.decode([Entity].self, from: data)
        } catch {
            print("Failed to load entities: \\(error)")
            return []
        }
    }
    
    // MARK: - Payment Links Storage
    func savePaymentLinks(_ links: [PaymentLink]) {
        do {
            let data = try encoder.encode(links)
            userDefaults.set(data, forKey: "paymentLinks")
        } catch {
            print("Failed to save payment links: \\(error)")
        }
    }
    
    func loadPaymentLinks() -> [PaymentLink] {
        guard let data = userDefaults.data(forKey: "paymentLinks") else {
            return []
        }
        
        do {
            return try decoder.decode([PaymentLink].self, from: data)
        } catch {
            print("Failed to load payment links: \\(error)")
            return []
        }
    }
    
    // MARK: - Generic Key-Value Storage
    func saveString(_ value: String, forKey key: String) {
        userDefaults.set(value, forKey: key)
    }
    
    func loadString(forKey key: String) -> String? {
        return userDefaults.string(forKey: key)
    }
    
    func saveBool(_ value: Bool, forKey key: String) {
        userDefaults.set(value, forKey: key)
    }
    
    func loadBool(forKey key: String) -> Bool? {
        let value = userDefaults.bool(forKey: key)
        return userDefaults.object(forKey: key) != nil ? value : nil
    }
    
    func saveInt(_ value: Int, forKey key: String) {
        userDefaults.set(value, forKey: key)
    }
    
    func loadInt(forKey key: String) -> Int? {
        let value = userDefaults.integer(forKey: key)
        return userDefaults.object(forKey: key) != nil ? value : nil
    }
    
    func saveDouble(_ value: Double, forKey key: String) {
        userDefaults.set(value, forKey: key)
    }
    
    func loadDouble(forKey key: String) -> Double? {
        let value = userDefaults.double(forKey: key)
        return userDefaults.object(forKey: key) != nil ? value : nil
    }
    
    func removeObject(forKey key: String) {
        userDefaults.removeObject(forKey: key)
    }
    
    func clearAll() {
        if let bundleId = Bundle.main.bundleIdentifier {
            userDefaults.removePersistentDomain(forName: bundleId)
        }
    }
}

// MARK: - Keychain Manager
class KeychainManager {
    static let shared = KeychainManager()
    
    private let service = "com.protocolbanks.ios"
    
    func savePassword(_ password: String, forAccount account: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: password.data(using: .utf8) ?? Data()
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func loadPassword(forAccount account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let password = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return password
    }
    
    func deletePassword(forAccount account: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess
    }
    
    func saveBiometric(_ enabled: Bool, forAccount account: String) {
        let key = "biometric_enabled_\\(account)"
        UserDefaults.standard.set(enabled, forKey: key)
    }
    
    func loadBiometric(forAccount account: String) -> Bool {
        let key = "biometric_enabled_\\(account)"
        return UserDefaults.standard.bool(forKey: key)
    }
}
