import SwiftUI

// MARK: - Splash Screen
struct SplashScreenView: View {
    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()
            
            VStack(spacing: Spacing.lg) {
                Spacer()
                
                // Logo
                VStack(spacing: Spacing.md) {
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.brandGreen)
                    
                    Text("Protocol Banks")
                        .font(Typography.heading1)
                        .foregroundColor(.textPrimary)
                    
                    Text("Enterprise Crypto Payments")
                        .font(Typography.bodyMedium)
                        .foregroundColor(.textSecondary)
                }
                
                Spacer()
                
                // Loading indicator
                VStack(spacing: Spacing.md) {
                    ProgressView()
                        .tint(.brandGreen)
                    
                    Text("Loading...")
                        .font(Typography.bodySmall)
                        .foregroundColor(.textSecondary)
                }
            }
            .padding(Spacing.lg)
        }
    }
}

// MARK: - Wallet Connect View
struct WalletConnectView: View {
    @StateObject private var viewModel = WalletConnectViewModel()
    @EnvironmentObject var appCoordinator: AppCoordinator
    
    var body: some View {
        ZStack {
            Color.backgroundPrimary.ignoresSafeArea()
            
            VStack(spacing: Spacing.lg) {
                Spacer()
                
                // Header
                VStack(spacing: Spacing.md) {
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.brandGreen)
                    
                    Text("Protocol Banks")
                        .font(Typography.heading2)
                        .foregroundColor(.textPrimary)
                    
                    Text("Connect your wallet to get started")
                        .font(Typography.bodyMedium)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                }
                
                Spacer()
                
                // Features
                VStack(spacing: Spacing.md) {
                    FeatureRow(
                        icon: "paperplane.fill",
                        title: "Batch Payments",
                        description: "Send to multiple recipients at once"
                    )
                    
                    FeatureRow(
                        icon: "chart.bar.fill",
                        title: "Analytics",
                        description: "Track your payment history"
                    )
                    
                    FeatureRow(
                        icon: "network",
                        title: "Multi-Chain",
                        description: "Support for multiple blockchains"
                    )
                }
                .padding(Spacing.lg)
                .background(Color.backgroundSecondary)
                .cornerRadius(CornerRadii.large)
                
                Spacer()
                
                // Connect Buttons
                VStack(spacing: Spacing.md) {
                    PrimaryButton(
                        title: "Connect MetaMask",
                        action: { viewModel.connectMetaMask() },
                        isLoading: viewModel.isConnecting,
                        icon: "link.circle.fill"
                    )
                    
                    SecondaryButton(
                        title: "Try Demo",
                        action: { viewModel.connectDemo() },
                        isLoading: viewModel.isConnecting
                    )
                }
                
                // Error Message
                if let error = viewModel.errorMessage {
                    VStack(spacing: Spacing.sm) {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.errorRed)
                            
                            Text(error)
                                .font(Typography.bodySmall)
                                .foregroundColor(.errorRed)
                        }
                        .padding(Spacing.md)
                        .background(Color.errorRed.opacity(0.1))
                        .cornerRadius(CornerRadii.medium)
                    }
                }
                
                // Footer
                VStack(spacing: Spacing.sm) {
                    Text("By connecting, you agree to our Terms of Service")
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                        .multilineTextAlignment(.center)
                    
                    HStack(spacing: Spacing.md) {
                        Link("Privacy Policy", destination: URL(string: "https://protocolbanks.com/privacy")!)
                            .font(Typography.captionSmall)
                            .foregroundColor(.brandGreen)
                        
                        Divider()
                            .frame(height: 12)
                        
                        Link("Terms", destination: URL(string: "https://protocolbanks.com/terms")!)
                            .font(Typography.captionSmall)
                            .foregroundColor(.brandGreen)
                    }
                }
            }
            .padding(Spacing.lg)
        }
        .onChange(of: viewModel.isConnected) { oldValue, newValue in
            if newValue {
                appCoordinator.appState = .main
            }
        }
    }
}

// MARK: - Feature Row
struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(.brandGreen)
                .frame(width: 40)
            
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(title)
                    .font(Typography.bodyMedium)
                    .fontWeight(.semibold)
                    .foregroundColor(.textPrimary)
                
                Text(description)
                    .font(Typography.captionSmall)
                    .foregroundColor(.textSecondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Wallet Connect ViewModel
class WalletConnectViewModel: ObservableObject {
    @Published var isConnecting: Bool = false
    @Published var errorMessage: String?
    @Published var isConnected: Bool = false
    
    private let walletManager = WalletManager.shared
    
    func connectMetaMask() {
        isConnecting = true
        errorMessage = nil
        
        // 实际实现中应该使用WalletConnect SDK
        Task {
            do {
                walletManager.connectWallet()
                
                await MainActor.run {
                    self.isConnected = true
                    self.isConnecting = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isConnecting = false
                }
            }
        }
    }
    
    func connectDemo() {
        isConnecting = true
        errorMessage = nil
        
        // 模拟演示模式连接
        Task {
            try await Task.sleep(nanoseconds: 2_000_000_000)
            
            await MainActor.run {
                self.isConnected = true
                self.isConnecting = false
            }
        }
    }
}

#Preview {
    WalletConnectView()
        .environmentObject(AppCoordinator())
}
