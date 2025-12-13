import SwiftUI

@main
struct ProtocolBanksApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    @StateObject private var walletManager = WalletManager.shared
    @StateObject private var themeManager = ThemeManager.shared
    
    var body: some Scene {
        WindowGroup {
            ZStack {
                // 根据应用状态显示不同的视图
                switch appCoordinator.appState {
                case .splash:
                    SplashScreenView()
                        .transition(.opacity)
                    
                case .walletConnect:
                    WalletConnectView()
                        .transition(.opacity)
                    
                case .main:
                    MainTabView()
                        .transition(.opacity)
                }
            }
            .environmentObject(appCoordinator)
            .environmentObject(walletManager)
            .environmentObject(themeManager)
            .preferredColorScheme(.dark)
            .onAppear {
                appCoordinator.checkAppState()
            }
        }
    }
}

// MARK: - App State
enum AppState {
    case splash
    case walletConnect
    case main
}

// MARK: - App Coordinator
class AppCoordinator: ObservableObject {
    @Published var appState: AppState = .splash
    
    private let walletManager = WalletManager.shared
    
    func checkAppState() {
        // 延迟显示启动屏幕
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if self.walletManager.isConnected {
                self.appState = .main
            } else {
                self.appState = .walletConnect
            }
        }
    }
    
    func connectWallet() {
        walletManager.connectWallet()
        appState = .main
    }
    
    func disconnectWallet() {
        walletManager.disconnectWallet()
        appState = .walletConnect
    }
}
