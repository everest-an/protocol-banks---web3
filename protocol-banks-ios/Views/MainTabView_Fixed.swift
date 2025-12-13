import SwiftUI

// MARK: - Main Tab View (Optimized)
struct MainTabViewOptimized: View {
    @State private var selectedTab: MainTab = .dashboard
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Dashboard Tab
            DashboardViewFixed()
                .tag(MainTab.dashboard)
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }
            
            // Batch Payment Tab
            BatchPaymentViewFixed()
                .tag(MainTab.batchPayment)
                .tabItem {
                    Label("Send", systemImage: "paperplane.fill")
                }
            
            // Receive Tab
            ReceivePaymentViewFixed()
                .tag(MainTab.receive)
                .tabItem {
                    Label("Receive", systemImage: "arrow.down.circle.fill")
                }
            
            // Wallet Tags Tab
            VendorsNetworkViewFixed()
                .tag(MainTab.vendors)
                .tabItem {
                    Label("Tags", systemImage: "tag.circle.fill")
                }
            
            // Analytics Tab
            AnalyticsViewFixed()
                .tag(MainTab.analytics)
                .tabItem {
                    Label("Analytics", systemImage: "chart.line.uptrend.xyaxis")
                }
            
            // Settings Tab
            SettingsViewFixed()
                .tag(MainTab.settings)
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .accentColor(.brandGreen)
    }
}

enum MainTab {
    case dashboard
    case batchPayment
    case receive
    case vendors
    case analytics
    case settings
}

// MARK: - Dashboard View (Fixed)
struct DashboardViewFixed: View {
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
                    ScrollView(.vertical, showsIndicators: true) {
                        VStack(alignment: .leading, spacing: Spacing.lg) {
                            // Header Section
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("Dashboard")
                                    .font(Typography.heading2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.textPrimary)
                                
                                Text("Manage your crypto payments")
                                    .font(Typography.bodyMedium)
                                    .foregroundColor(.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, Spacing.md)
                            .padding(.top, Spacing.md)
                            
                            // Metrics Grid - Row 1
                            HStack(spacing: Spacing.md) {
                                MetricCardFixed(
                                    title: "Total Sent",
                                    value: viewModel.formatCurrency(viewModel.metrics?.totalSent ?? 0),
                                    subtitle: "Lifetime",
                                    icon: "dollarsign.circle.fill",
                                    valueColor: .brandGreen
                                )
                                
                                MetricCardFixed(
                                    title: "Transactions",
                                    value: "\\(viewModel.metrics?.transactionCount ?? 0)",
                                    subtitle: "Total",
                                    icon: "arrow.left.arrow.right.circle.fill",
                                    valueColor: .infoBlue
                                )
                            }
                            .padding(.horizontal, Spacing.md)
                            
                            // Metrics Grid - Row 2
                            HStack(spacing: Spacing.md) {
                                MetricCardFixed(
                                    title: "Wallet Tags",
                                    value: "\\(viewModel.metrics?.walletTagCount ?? 0)",
                                    subtitle: "Registered",
                                    icon: "tag.circle.fill",
                                    valueColor: .warningYellow
                                )
                                
                                MetricCardFixed(
                                    title: "This Week",
                                    value: "\\(viewModel.metrics?.thisWeekPayments ?? 0)",
                                    subtitle: "Payments",
                                    icon: "calendar.circle.fill",
                                    valueColor: .successGreen
                                )
                            }
                            .padding(.horizontal, Spacing.md)
                            
                            // Financial Health Section
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("Financial Health")
                                    .font(Typography.heading4)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.textPrimary)
                                    .padding(.horizontal, Spacing.md)
                                
                                // Health Metrics Row 1
                                HStack(spacing: Spacing.md) {
                                    MetricCardFixed(
                                        title: "Monthly Burn",
                                        value: viewModel.formatCurrency(viewModel.metrics?.monthlyBurnRate ?? 0),
                                        subtitle: "Rate",
                                        icon: "flame.circle.fill",
                                        valueColor: .errorRed
                                    )
                                    
                                    MetricCardFixed(
                                        title: "Runway",
                                        value: "\\(String(format: "%.1f", viewModel.metrics?.estimatedRunway ?? 0))M",
                                        subtitle: "Months",
                                        icon: "calendar.circle.fill",
                                        valueColor: .infoBlue
                                    )
                                }
                                .padding(.horizontal, Spacing.md)
                                
                                // Health Metrics Row 2
                                HStack(spacing: Spacing.md) {
                                    MetricCardFixed(
                                        title: "Top Category",
                                        value: viewModel.metrics?.topExpenseCategory ?? "N/A",
                                        subtitle: viewModel.formatCurrency(viewModel.metrics?.topExpenseCategoryAmount ?? 0),
                                        icon: "chart.pie.fill",
                                        valueColor: .brandGreen
                                    )
                                    
                                    MetricCardFixed(
                                        title: "Avg Transaction",
                                        value: viewModel.formatCurrency(viewModel.metrics?.averageTransaction ?? 0),
                                        subtitle: "Per tx",
                                        icon: "chart.bar.fill",
                                        valueColor: .infoBlue
                                    )
                                }
                                .padding(.horizontal, Spacing.md)
                            }
                            
                            // Recent Transactions Section
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                HStack {
                                    Text("Recent Transactions")
                                        .font(Typography.heading4)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.textPrimary)
                                    
                                    Spacer()
                                    
                                    NavigationLink(destination: AnalyticsViewFixed()) {
                                        Text("View All")
                                            .font(Typography.bodySmall)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.brandGreen)
                                    }
                                }
                                .padding(.horizontal, Spacing.md)
                                
                                if viewModel.recentTransactions.isEmpty {
                                    VStack(spacing: Spacing.md) {
                                        Image(systemName: "arrow.left.arrow.right.circle")
                                            .font(.system(size: 40))
                                            .foregroundColor(.textSecondary)
                                        
                                        Text("No transactions yet")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textSecondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(Spacing.lg)
                                } else {
                                    VStack(spacing: Spacing.sm) {
                                        ForEach(viewModel.recentTransactions.prefix(5)) { transaction in
                                            TransactionRowViewFixed(transaction: transaction)
                                        }
                                    }
                                    .padding(.horizontal, Spacing.md)
                                }
                            }
                            
                            Spacer(minLength: Spacing.xl)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
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

// MARK: - Transaction Row View (Fixed)
struct TransactionRowViewFixed: View {
    let transaction: Transaction
    @State private var showDetail = false
    
    var statusColor: Color {
        switch transaction.status {
        case .pending:
            return .warningYellow
        case .completed, .confirmed:
            return .successGreen
        case .failed:
            return .errorRed
        }
    }
    
    var body: some View {
        NavigationLink(destination: TransactionDetailView(transaction: transaction)) {
            CardView {
                HStack(spacing: Spacing.md) {
                    // Left side - Address and Category
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(transaction.to.prefix(10) + "...")
                            .font(Typography.bodyMedium)
                            .fontWeight(.semibold)
                            .foregroundColor(.textPrimary)
                        
                        Text(transaction.category ?? "Uncategorized")
                            .font(Typography.captionSmall)
                            .foregroundColor(.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    // Right side - Amount and Status
                    VStack(alignment: .trailing, spacing: Spacing.xs) {
                        Text("-\\(transaction.amount.description) \\(transaction.token)")
                            .font(Typography.bodyMedium)
                            .fontWeight(.semibold)
                            .foregroundColor(.errorRed)
                        
                        HStack(spacing: Spacing.xs) {
                            Circle()
                                .fill(statusColor)
                                .frame(width: 6, height: 6)
                            
                            Text(transaction.status.rawValue.capitalized)
                                .font(Typography.captionSmall)
                                .foregroundColor(statusColor)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Batch Payment View (Fixed)
struct BatchPaymentViewFixed: View {
    @StateObject private var viewModel = BatchPaymentViewModel()
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Batch Payment")
                                .font(Typography.heading2)
                                .fontWeight(.bold)
                                .foregroundColor(.textPrimary)
                            
                            Text("Send to multiple recipients")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.md)
                        
                        // Chain Selection
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Select Network")
                                .font(Typography.bodySmall)
                                .fontWeight(.semibold)
                                .foregroundColor(.textSecondary)
                            
                            Picker("Chain", selection: $viewModel.selectedChain) {
                                ForEach([BlockchainChain.ethereum, .base, .polygon, .arbitrum], id: \\.self) { chain in
                                    Text(chain.rawValue).tag(chain)
                                }
                            }
                            .pickerStyle(.segmented)
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // Recipients Section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                Text("Recipients")
                                    .font(Typography.heading4)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.textPrimary)
                                
                                Spacer()
                                
                                Button(action: { viewModel.addRecipient() }) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundColor(.brandGreen)
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                            
                            VStack(spacing: Spacing.sm) {
                                ForEach(viewModel.recipients.indices, id: \\.self) { index in
                                    RecipientInputRow(
                                        recipient: $viewModel.recipients[index],
                                        onRemove: { viewModel.removeRecipient(at: index) },
                                        canRemove: viewModel.recipients.count > 1
                                    )
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // Summary Card
                        CardView {
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                HStack {
                                    Text("Payment Summary")
                                        .font(Typography.heading4)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.textPrimary)
                                    Spacer()
                                }
                                
                                Divider().background(Color.borderColor)
                                
                                HStack {
                                    Text("Recipients")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text("\\(viewModel.recipients.count)")
                                        .font(Typography.bodySmall)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.textPrimary)
                                }
                                
                                HStack {
                                    Text("Total Amount")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                    Spacer()
                                    Text(viewModel.formatCurrency(viewModel.totalAmount))
                                        .font(Typography.bodySmall)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.brandGreen)
                                }
                            }
                        }
                        .padding(.horizontal, Spacing.md)
                        
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
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // Success Message
                        if let success = viewModel.successMessage {
                            VStack(spacing: Spacing.sm) {
                                HStack(spacing: Spacing.sm) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.successGreen)
                                    
                                    Text(success)
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.successGreen)
                                }
                                .padding(Spacing.md)
                                .background(Color.successGreen.opacity(0.1))
                                .cornerRadius(CornerRadii.medium)
                            }
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // Submit Button
                        PrimaryButton(
                            title: "Submit Payment",
                            action: { viewModel.submitPayment() },
                            isLoading: viewModel.isSubmitting,
                            icon: "paperplane.fill"
                        )
                        .padding(.horizontal, Spacing.md)
                        
                        Spacer(minLength: Spacing.xl)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Recipient Input Row
struct RecipientInputRow: View {
    @Binding var recipient: PaymentRecipient
    let onRemove: () -> Void
    let canRemove: Bool
    
    var body: some View {
        CardView {
            VStack(spacing: Spacing.md) {
                // Address Input
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Recipient Address")
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                    
                    TextField("0x...", text: $recipient.address)
                        .font(Typography.bodySmall)
                        .foregroundColor(.textPrimary)
                        .padding(Spacing.sm)
                        .background(Color.backgroundSecondary)
                        .cornerRadius(CornerRadii.small)
                }
                
                // Amount and Remove Button
                HStack(spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text("Amount")
                            .font(Typography.captionSmall)
                            .foregroundColor(.textSecondary)
                        
                        TextField("0.00", value: $recipient.amount, format: .number)
                            .font(Typography.bodySmall)
                            .foregroundColor(.textPrimary)
                            .padding(Spacing.sm)
                            .background(Color.backgroundSecondary)
                            .cornerRadius(CornerRadii.small)
                    }
                    
                    if canRemove {
                        Button(action: onRemove) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.errorRed)
                        }
                        .padding(.top, Spacing.lg)
                    }
                }
            }
        }
    }
}

// MARK: - Receive Payment View (Fixed)
struct ReceivePaymentViewFixed: View {
    @StateObject private var viewModel = ReceivePaymentViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Receive Payment")
                                .font(Typography.heading2)
                                .fontWeight(.bold)
                                .foregroundColor(.textPrimary)
                            
                            Text("Create a secure payment link")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.md)
                        
                        if viewModel.generatedLink == nil {
                            // Input Form
                            VStack(spacing: Spacing.md) {
                                InputField(
                                    label: "Recipient Address",
                                    placeholder: "0x...",
                                    text: $viewModel.recipientAddress,
                                    icon: "wallet.pass.fill"
                                )
                                
                                InputField(
                                    label: "Amount",
                                    placeholder: "0.00",
                                    text: $viewModel.amount,
                                    icon: "dollarsign.circle.fill"
                                )
                                
                                VStack(alignment: .leading, spacing: Spacing.sm) {
                                    Text("Token")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                    
                                    Picker("Token", selection: $viewModel.selectedToken) {
                                        ForEach(["USDC", "USDT", "DAI"], id: \\.self) { token in
                                            Text(token).tag(token)
                                        }
                                    }
                                    .pickerStyle(.segmented)
                                }
                                
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
                                
                                PrimaryButton(
                                    title: "Generate Link",
                                    action: { viewModel.generatePaymentLink() },
                                    isLoading: viewModel.isGenerating,
                                    icon: "link.circle.fill"
                                )
                            }
                            .padding(Spacing.md)
                        } else if let link = viewModel.generatedLink {
                            // Generated Link Display
                            VStack(spacing: Spacing.md) {
                                CardView {
                                    VStack(alignment: .leading, spacing: Spacing.md) {
                                        HStack {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundColor(.successGreen)
                                            
                                            Text("Payment Link Created")
                                                .font(Typography.heading4)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.textPrimary)
                                            
                                            Spacer()
                                        }
                                        
                                        Divider().background(Color.borderColor)
                                        
                                        VStack(alignment: .leading, spacing: Spacing.sm) {
                                            Text("Amount")
                                                .font(Typography.captionSmall)
                                                .foregroundColor(.textSecondary)
                                            
                                            Text("\\(link.amount) \\(link.token)")
                                                .font(Typography.heading4)
                                                .fontWeight(.semibold)
                                                .foregroundColor(.brandGreen)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: Spacing.sm) {
                                            Text("Link")
                                                .font(Typography.captionSmall)
                                                .foregroundColor(.textSecondary)
                                            
                                            Text(link.shareableUrl)
                                                .font(Typography.captionSmall)
                                                .foregroundColor(.textPrimary)
                                                .lineLimit(2)
                                        }
                                    }
                                }
                                
                                HStack(spacing: Spacing.md) {
                                    PrimaryButton(
                                        title: "Copy",
                                        action: { viewModel.copyLink() },
                                        icon: "doc.on.doc.fill"
                                    )
                                    
                                    SecondaryButton(
                                        title: "Share",
                                        action: { viewModel.shareLink() }
                                    )
                                }
                                
                                Button(action: { viewModel.generatedLink = nil }) {
                                    Text("Create Another")
                                        .font(Typography.bodySmall)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.brandGreen)
                                        .frame(maxWidth: .infinity)
                                        .padding(Spacing.md)
                                        .background(Color.brandGreen.opacity(0.1))
                                        .cornerRadius(CornerRadii.medium)
                                }
                            }
                            .padding(Spacing.md)
                        }
                        
                        Spacer(minLength: Spacing.xl)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Analytics View (Fixed)
struct AnalyticsViewFixed: View {
    @StateObject private var viewModel = AnalyticsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                if viewModel.isLoading {
                    LoadingView()
                } else {
                    ScrollView(.vertical, showsIndicators: true) {
                        VStack(alignment: .leading, spacing: Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("Analytics")
                                    .font(Typography.heading2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.textPrimary)
                                
                                Text("\\(viewModel.transactions.count) transactions")
                                    .font(Typography.bodyMedium)
                                    .foregroundColor(.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, Spacing.md)
                            .padding(.top, Spacing.md)
                            
                            // Transactions List
                            VStack(spacing: Spacing.sm) {
                                ForEach(viewModel.transactions) { transaction in
                                    TransactionRowViewFixed(transaction: transaction)
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                            
                            if viewModel.transactions.isEmpty {
                                VStack(spacing: Spacing.md) {
                                    Image(systemName: "chart.line.uptrend.xyaxis")
                                        .font(.system(size: 40))
                                        .foregroundColor(.textSecondary)
                                    
                                    Text("No transactions yet")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(Spacing.lg)
                            }
                            
                            Spacer(minLength: Spacing.xl)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
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

// MARK: - Settings View (Fixed)
struct SettingsViewFixed: View {
    @StateObject private var viewModel = SettingsViewModel()
    @EnvironmentObject var walletManager: WalletManager
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Header
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Settings")
                                .font(Typography.heading2)
                                .fontWeight(.bold)
                                .foregroundColor(.textPrimary)
                            
                            Text("Manage your preferences")
                                .font(Typography.bodyMedium)
                                .foregroundColor(.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.md)
                        
                        // Display Settings
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("Display")
                                .font(Typography.heading4)
                                .fontWeight(.semibold)
                                .foregroundColor(.textPrimary)
                                .padding(.horizontal, Spacing.md)
                            
                            CardView {
                                VStack(spacing: Spacing.md) {
                                    HStack {
                                        Text("Dark Mode")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textPrimary)
                                        
                                        Spacer()
                                        
                                        Toggle("", isOn: Binding(
                                            get: { viewModel.isDarkMode },
                                            set: { viewModel.saveDarkMode($0) }
                                        ))
                                    }
                                    
                                    Divider().background(Color.borderColor)
                                    
                                    HStack {
                                        Text("Notifications")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textPrimary)
                                        
                                        Spacer()
                                        
                                        Toggle("", isOn: Binding(
                                            get: { viewModel.notificationsEnabled },
                                            set: { viewModel.saveNotifications($0) }
                                        ))
                                    }
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // Security Settings
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("Security")
                                .font(Typography.heading4)
                                .fontWeight(.semibold)
                                .foregroundColor(.textPrimary)
                                .padding(.horizontal, Spacing.md)
                            
                            CardView {
                                VStack(spacing: Spacing.md) {
                                    HStack {
                                        Text("Biometric Auth")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textPrimary)
                                        
                                        Spacer()
                                        
                                        Toggle("", isOn: Binding(
                                            get: { viewModel.biometricEnabled },
                                            set: { viewModel.saveBiometric($0) }
                                        ))
                                    }
                                    
                                    Divider().background(Color.borderColor)
                                    
                                    HStack {
                                        Text("Connected Wallet")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textPrimary)
                                        
                                        Spacer()
                                        
                                        Text(walletManager.currentWallet?.address.prefix(10) ?? "Not connected")
                                            .font(Typography.captionSmall)
                                            .foregroundColor(.textSecondary)
                                    }
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        // About Section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("About")
                                .font(Typography.heading4)
                                .fontWeight(.semibold)
                                .foregroundColor(.textPrimary)
                                .padding(.horizontal, Spacing.md)
                            
                            CardView {
                                VStack(spacing: Spacing.md) {
                                    HStack {
                                        Text("Version")
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textPrimary)
                                        
                                        Spacer()
                                        
                                        Text("1.0.0")
                                            .font(Typography.bodySmall)
                                            .fontWeight(.semibold)
                                            .foregroundColor(.textSecondary)
                                    }
                                    
                                    Divider().background(Color.borderColor)
                                    
                                    Link(destination: URL(string: "https://protocolbanks.com")!) {
                                        HStack {
                                            Text("Visit Website")
                                                .font(Typography.bodySmall)
                                                .foregroundColor(.brandGreen)
                                            
                                            Spacer()
                                            
                                            Image(systemName: "arrow.up.right")
                                                .font(.system(size: 12))
                                                .foregroundColor(.brandGreen)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, Spacing.md)
                        }
                        
                        Spacer(minLength: Spacing.xl)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Vendors Network View (Fixed)
struct VendorsNetworkViewFixed: View {
    @StateObject private var viewModel = VendorManagementViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                if viewModel.isLoading {
                    LoadingView()
                } else {
                    ScrollView(.vertical, showsIndicators: true) {
                        VStack(alignment: .leading, spacing: Spacing.lg) {
                            // Header
                            HStack {
                                VStack(alignment: .leading, spacing: Spacing.sm) {
                                    Text("Wallet Tags")
                                        .font(Typography.heading2)
                                        .fontWeight(.bold)
                                        .foregroundColor(.textPrimary)
                                    
                                    Text("Manage your payment network")
                                        .font(Typography.bodyMedium)
                                        .foregroundColor(.textSecondary)
                                }
                                
                                Spacer()
                                
                                Button(action: { viewModel.showAddForm = true }) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 24))
                                        .foregroundColor(.brandGreen)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, Spacing.md)
                            .padding(.top, Spacing.md)
                            
                            // Entities List
                            if viewModel.entities.isEmpty {
                                VStack(spacing: Spacing.md) {
                                    Image(systemName: "tag.circle")
                                        .font(.system(size: 40))
                                        .foregroundColor(.textSecondary)
                                    
                                    Text("No wallet tags yet")
                                        .font(Typography.bodySmall)
                                        .foregroundColor(.textSecondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(Spacing.lg)
                            } else {
                                VStack(spacing: Spacing.sm) {
                                    ForEach(viewModel.entities) { entity in
                                        EntityCardView(
                                            entity: entity,
                                            onTap: { viewModel.selectedEntity = entity }
                                        )
                                    }
                                }
                                .padding(.horizontal, Spacing.md)
                            }
                            
                            Spacer(minLength: Spacing.xl)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $viewModel.showAddForm) {
                AddEntitySheetView(viewModel: viewModel)
            }
            .sheet(item: Binding(
                get: { viewModel.selectedEntity },
                set: { viewModel.selectedEntity = $0 }
            )) { entity in
                EntityDetailView(entity: entity, viewModel: viewModel)
            }
            .onAppear {
                viewModel.loadEntities()
            }
        }
    }
}

// MARK: - Metric Card (Fixed)
struct MetricCardFixed: View {
    let title: String
    let value: String
    let subtitle: String?
    let icon: String
    let valueColor: Color
    
    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                        .foregroundColor(valueColor)
                    
                    Text(title)
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                    
                    Spacer()
                }
                
                Text(value)
                    .font(Typography.heading4)
                    .fontWeight(.bold)
                    .foregroundColor(valueColor)
                    .lineLimit(1)
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                        .lineLimit(1)
                }
            }
        }
    }
}

#Preview {
    MainTabViewOptimized()
        .environmentObject(WalletManager.shared)
}
