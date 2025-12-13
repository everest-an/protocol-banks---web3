import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: MainTab = .dashboard
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        ZStack {
            TabView(selection: $selectedTab) {
                // Dashboard Tab
                DashboardView()
                    .tag(MainTab.dashboard)
                    .tabItem {
                        Label("Dashboard", systemImage: "chart.bar.fill")
                    }
                
                // Batch Payment Tab
                BatchPaymentView()
                    .tag(MainTab.batchPayment)
                    .tabItem {
                        Label("Send", systemImage: "paperplane.fill")
                    }
                
                // Receive Tab
                ReceivePaymentView()
                    .tag(MainTab.receive)
                    .tabItem {
                        Label("Receive", systemImage: "arrow.down.circle.fill")
                    }
                
                // Analytics Tab
                AnalyticsView()
                    .tag(MainTab.analytics)
                    .tabItem {
                        Label("Analytics", systemImage: "chart.line.uptrend.xyaxis")
                    }
                
                // Settings Tab
                SettingsView()
                    .tag(MainTab.settings)
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
            }
            .accentColor(.brandGreen)
        }
    }
}

enum MainTab {
    case dashboard
    case batchPayment
    case receive
    case analytics
    case settings
}

// MARK: - Dashboard View
struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                if viewModel.isLoading {
                    LoadingView()
                } else if let error = viewModel.errorMessage {
                    ErrorView(message: error) {
                        viewModel.loadData()
                    }
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("Dashboard")
                                    .font(Typography.heading2)
                                    .foregroundColor(.textPrimary)
                                
                                Text("Manage your crypto payments")
                                    .font(Typography.bodyMedium)
                                    .foregroundColor(.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Spacing.md)
                            
                            // Metrics Grid
                            VStack(spacing: Spacing.md) {
                                HStack(spacing: Spacing.md) {
                                    MetricCard(
                                        title: "Total Sent",
                                        value: viewModel.formatCurrency(viewModel.metrics?.totalSent ?? 0),
                                        subtitle: "Lifetime payments",
                                        icon: "dollarsign.circle.fill"
                                    )
                                    
                                    MetricCard(
                                        title: "Transactions",
                                        value: "\\(viewModel.metrics?.transactionCount ?? 0)",
                                        subtitle: "Total payments made",
                                        icon: "arrow.left.arrow.right.circle.fill"
                                    )
                                }
                                
                                HStack(spacing: Spacing.md) {
                                    MetricCard(
                                        title: "Wallet Tags",
                                        value: "\\(viewModel.metrics?.walletTagCount ?? 0)",
                                        subtitle: "Registered tags",
                                        icon: "tag.circle.fill"
                                    )
                                    
                                    MetricCard(
                                        title: "This Week",
                                        value: "\\(viewModel.metrics?.thisWeekPayments ?? 0)",
                                        subtitle: "Payments last 7 days",
                                        icon: "calendar.circle.fill"
                                    )
                                }
                            }
                            .padding(Spacing.md)
                            
                            // Financial Health Section
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("Financial Health")
                                    .font(Typography.heading4)
                                    .foregroundColor(.textPrimary)
                                    .padding(.horizontal, Spacing.md)
                                
                                VStack(spacing: Spacing.md) {
                                    HStack(spacing: Spacing.md) {
                                        MetricCard(
                                            title: "Monthly Burn Rate",
                                            value: viewModel.formatCurrency(viewModel.metrics?.monthlyBurnRate ?? 0),
                                            subtitle: "0.0% from last month",
                                            icon: "flame.circle.fill"
                                        )
                                        
                                        MetricCard(
                                            title: "Estimated Runway",
                                            value: "\\(String(format: "%.1f", viewModel.metrics?.estimatedRunway ?? 0)) Months",
                                            subtitle: "Based on holdings",
                                            icon: "calendar.circle.fill"
                                        )
                                    }
                                    
                                    HStack(spacing: Spacing.md) {
                                        MetricCard(
                                            title: "Top Category",
                                            value: viewModel.metrics?.topExpenseCategory ?? "N/A",
                                            subtitle: viewModel.formatCurrency(viewModel.metrics?.topExpenseCategoryAmount ?? 0),
                                            icon: "chart.pie.fill"
                                        )
                                        
                                        MetricCard(
                                            title: "Avg Transaction",
                                            value: viewModel.formatCurrency(viewModel.metrics?.averageTransaction ?? 0),
                                            subtitle: "Per transaction",
                                            icon: "chart.bar.fill"
                                        )
                                    }
                                }
                                .padding(Spacing.md)
                            }
                            
                            // Recent Transactions
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                HStack {
                                    Text("Recent Transactions")
                                        .font(Typography.heading4)
                                        .foregroundColor(.textPrimary)
                                    
                                    Spacer()
                                    
                                    NavigationLink(destination: AnalyticsView()) {
                                        Text("View All")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.brandGreen)
                                    }
                                }
                                .padding(.horizontal, Spacing.md)
                                
                                VStack(spacing: Spacing.sm) {
                                    ForEach(viewModel.recentTransactions.prefix(5)) { transaction in
                                        TransactionRowView(transaction: transaction)
                                    }
                                }
                                .padding(Spacing.md)
                            }
                            
                            Spacer(minLength: Spacing.xl)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                viewModel.loadData()
            }
        }
    }
}

// MARK: - Transaction Row View
struct TransactionRowView: View {
    let transaction: Transaction
    
    var body: some View {
        CardView {
            HStack(spacing: Spacing.md) {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(transaction.to)
                        .font(Typography.bodyMedium)
                        .fontWeight(.semibold)
                        .foregroundColor(.textPrimary)
                        .lineLimit(1)
                    
                    Text(transaction.category ?? "Uncategorized")
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: Spacing.xs) {
                    Text("-\\(transaction.amount.description) \\(transaction.token)")
                        .font(Typography.bodyMedium)
                        .fontWeight(.semibold)
                        .foregroundColor(.errorRed)
                    
                    StatusBadge(status: transaction.status)
                }
            }
        }
    }
}

// MARK: - Batch Payment View
struct BatchPaymentView: View {
    @StateObject private var viewModel = BatchPaymentViewModel()
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Batch Payment")
                                .font(Typography.heading2)
                                .foregroundColor(.textPrimary)
                            
                            Text("Send crypto to multiple recipients")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.md)
                        
                        // Network Selection
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Network")
                                .font(Typography.bodySmall)
                                .foregroundColor(.textSecondary)
                                .padding(.horizontal, Spacing.md)
                            
                            Picker("Network", selection: $viewModel.selectedChain) {
                                ForEach(BlockchainChain.allCases, id: \\.self) { chain in
                                    Text(chain.rawValue).tag(chain)
                                }
                            }
                            .pickerStyle(.segmented)
                            .padding(Spacing.md)
                        }
                        
                        // Recipients Section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                Text("Recipients")
                                    .font(Typography.heading4)
                                    .foregroundColor(.textPrimary)
                                
                                Spacer()
                                
                                Button(action: { viewModel.addRecipient() }) {
                                    HStack(spacing: Spacing.xs) {
                                        Image(systemName: "plus.circle.fill")
                                        Text("Add")
                                    }
                                    .font(Typography.bodySmall)
                                    .foregroundColor(.brandGreen)
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                            
                            VStack(spacing: Spacing.sm) {
                                ForEach(Array(viewModel.recipients.enumerated()), id: \\.offset) { index, recipient in
                                    RecipientInputView(
                                        recipient: $viewModel.recipients[index],
                                        onRemove: { viewModel.removeRecipient(at: index) }
                                    )
                                }
                            }
                            .padding(Spacing.md)
                        }
                        
                        // Summary
                        CardView {
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("Summary")
                                    .font(Typography.heading4)
                                    .foregroundColor(.textPrimary)
                                
                                Divider()
                                    .background(Color.borderColor)
                                
                                HStack {
                                    Text("Recipients")
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text("\\(viewModel.recipients.count)")
                                        .fontWeight(.semibold)
                                        .foregroundColor(.textPrimary)
                                }
                                
                                HStack {
                                    Text("Total Amount")
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text(viewModel.formatCurrency(viewModel.totalAmount))
                                        .fontWeight(.semibold)
                                        .foregroundColor(.brandGreen)
                                }
                            }
                        }
                        .padding(Spacing.md)
                        
                        // Send Button
                        PrimaryButton(
                            title: "Send Batch Payment",
                            action: { viewModel.submitPayment() },
                            isLoading: viewModel.isSubmitting,
                            isEnabled: !viewModel.recipients.isEmpty
                        )
                        .padding(Spacing.md)
                        
                        Spacer(minLength: Spacing.xl)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Recipient Input View
struct RecipientInputView: View {
    @Binding var recipient: PaymentRecipient
    let onRemove: () -> Void
    
    var body: some View {
        CardView {
            VStack(spacing: Spacing.md) {
                InputField(
                    label: "Recipient Address",
                    placeholder: "0x...",
                    text: Binding(
                        get: { recipient.address },
                        set: { recipient.address = $0 }
                    ),
                    icon: "person.circle.fill"
                )
                
                HStack(spacing: Spacing.md) {
                    AmountInputField(
                        label: "Amount",
                        amount: Binding(
                            get: { recipient.amount.description },
                            set: { recipient.amount = Decimal(string: $0) ?? 0 }
                        ),
                        currency: recipient.token,
                        icon: "dollarsign.circle.fill"
                    )
                    
                    Button(action: onRemove) {
                        Image(systemName: "trash.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.errorRed)
                    }
                }
            }
        }
    }
}

// MARK: - Receive Payment View
struct ReceivePaymentView: View {
    @StateObject private var viewModel = ReceivePaymentViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Receive Payments")
                                .font(Typography.heading2)
                                .foregroundColor(.textPrimary)
                            
                            Text("Generate secure payment links")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.md)
                        
                        CardView {
                            VStack(spacing: Spacing.md) {
                                InputField(
                                    label: "Recipient Address",
                                    placeholder: "0x...",
                                    text: $viewModel.recipientAddress,
                                    icon: "person.circle.fill"
                                )
                                
                                AmountInputField(
                                    label: "Amount",
                                    amount: $viewModel.amount,
                                    currency: viewModel.selectedToken,
                                    icon: "dollarsign.circle.fill"
                                )
                                
                                InputField(
                                    label: "Token",
                                    placeholder: "USDC",
                                    text: $viewModel.selectedToken
                                )
                                
                                PrimaryButton(
                                    title: "Generate Link",
                                    action: { viewModel.generatePaymentLink() },
                                    isLoading: viewModel.isGenerating
                                )
                            }
                        }
                        .padding(Spacing.md)
                        
                        if let link = viewModel.generatedLink {
                            CardView {
                                VStack(spacing: Spacing.md) {
                                    Text("Shareable Link")
                                        .font(Typography.heading4)
                                        .foregroundColor(.textPrimary)
                                    
                                    Text(link.shareableUrl ?? "")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                        .lineLimit(2)
                                    
                                    HStack(spacing: Spacing.md) {
                                        PrimaryButton(
                                            title: "Copy Link",
                                            action: { viewModel.copyLink() }
                                        )
                                        
                                        SecondaryButton(
                                            title: "Share",
                                            action: { viewModel.shareLink() }
                                        )
                                    }
                                }
                            }
                            .padding(Spacing.md)
                        }
                        
                        Spacer(minLength: Spacing.xl)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Analytics View
struct AnalyticsView: View {
    @StateObject private var viewModel = AnalyticsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                if viewModel.isLoading {
                    LoadingView()
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("Analytics")
                                    .font(Typography.heading2)
                                    .foregroundColor(.textPrimary)
                                
                                Text("Detailed transaction history")
                                    .font(Typography.bodyMedium)
                                    .foregroundColor(.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Spacing.md)
                            
                            // Transactions List
                            VStack(spacing: Spacing.sm) {
                                ForEach(viewModel.transactions) { transaction in
                                    TransactionRowView(transaction: transaction)
                                }
                            }
                            .padding(Spacing.md)
                            
                            Spacer(minLength: Spacing.xl)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                viewModel.loadTransactions()
            }
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var walletManager: WalletManager
    @EnvironmentObject var appCoordinator: AppCoordinator
    @StateObject private var viewModel = SettingsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Settings")
                                .font(Typography.heading2)
                                .foregroundColor(.textPrimary)
                            
                            Text("Manage your account")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.md)
                        
                        // Wallet Info
                        CardView {
                            VStack(spacing: Spacing.md) {
                                Text("Connected Wallet")
                                    .font(Typography.heading4)
                                    .foregroundColor(.textPrimary)
                                
                                if let wallet = walletManager.currentWallet {
                                    AddressDisplay(address: wallet.address)
                                }
                                
                                PrimaryButton(
                                    title: "Disconnect Wallet",
                                    action: {
                                        appCoordinator.disconnectWallet()
                                    }
                                )
                            }
                        }
                        .padding(Spacing.md)
                        
                        // About
                        CardView {
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("About")
                                    .font(Typography.heading4)
                                    .foregroundColor(.textPrimary)
                                
                                HStack {
                                    Text("Version")
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text("1.0.0")
                                        .foregroundColor(.textPrimary)
                                }
                                
                                HStack {
                                    Text("Build")
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text("1")
                                        .foregroundColor(.textPrimary)
                                }
                            }
                        }
                        .padding(Spacing.md)
                        
                        Spacer(minLength: Spacing.xl)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(WalletManager.shared)
        .environmentObject(AppCoordinator())
}
