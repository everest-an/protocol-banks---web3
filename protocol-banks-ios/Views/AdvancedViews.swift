import SwiftUI

// MARK: - Vendors Network View
struct VendorsNetworkView: View {
    @StateObject private var viewModel = VendorManagementViewModel()
    @State private var selectedEntity: Entity?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                if viewModel.isLoading {
                    LoadingView()
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                HStack {
                                    VStack(alignment: .leading, spacing: Spacing.sm) {
                                        Text("Wallet Tags")
                                            .font(Typography.heading2)
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
                            }
                            .padding(Spacing.md)
                            
                            // Entities List
                            VStack(spacing: Spacing.sm) {
                                ForEach(viewModel.entities) { entity in
                                    EntityCardView(
                                        entity: entity,
                                        onTap: { selectedEntity = entity }
                                    )
                                }
                            }
                            .padding(Spacing.md)
                            
                            if viewModel.entities.isEmpty {
                                EmptyStateView(
                                    title: "No Wallet Tags",
                                    message: "Create your first wallet tag to organize your payment network",
                                    icon: "tag.circle"
                                )
                                .padding(Spacing.lg)
                            }
                            
                            Spacer(minLength: Spacing.xl)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $viewModel.showAddForm) {
                AddEntitySheetView(viewModel: viewModel)
            }
            .sheet(item: $selectedEntity) { entity in
                EntityDetailView(entity: entity, viewModel: viewModel)
            }
            .onAppear {
                viewModel.loadEntities()
            }
        }
    }
}

// MARK: - Entity Card View
struct EntityCardView: View {
    let entity: Entity
    let onTap: () -> Void
    
    var categoryColor: Color {
        switch entity.category {
        case .supplier:
            return .infoBlue
        case .partner:
            return .brandGreen
        case .subsidiary:
            return .warningYellow
        case .other:
            return .textSecondary
        }
    }
    
    var body: some View {
        Button(action: onTap) {
            CardView {
                HStack(spacing: Spacing.md) {
                    Circle()
                        .fill(categoryColor.opacity(0.2))
                        .frame(width: 48, height: 48)
                        .overlay(
                            Text(String(entity.name.prefix(1)))
                                .font(Typography.heading4)
                                .foregroundColor(categoryColor)
                        )
                    
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(entity.name)
                            .font(Typography.bodyMedium)
                            .fontWeight(.semibold)
                            .foregroundColor(.textPrimary)
                        
                        Text(entity.address)
                            .font(Typography.captionSmall)
                            .foregroundColor(.textSecondary)
                            .lineLimit(1)
                    }
                    
                    Spacer()
                    
                    VStack(alignment: .trailing, spacing: Spacing.xs) {
                        Text(entity.category.rawValue)
                            .font(Typography.captionSmall)
                            .fontWeight(.medium)
                            .foregroundColor(categoryColor)
                        
                        Text("\\(entity.transactionCount) txns")
                            .font(Typography.captionSmall)
                            .foregroundColor(.textSecondary)
                    }
                }
            }
        }
    }
}

// MARK: - Add Entity Sheet
struct AddEntitySheetView: View {
    @ObservedObject var viewModel: VendorManagementViewModel
    @Environment(\\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        InputField(
                            label: "Name",
                            placeholder: "Entity name",
                            text: $viewModel.newEntityName,
                            icon: "person.circle.fill"
                        )
                        
                        InputField(
                            label: "Wallet Address",
                            placeholder: "0x...",
                            text: $viewModel.newEntityAddress,
                            icon: "wallet.pass.fill"
                        )
                        
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Category")
                                .font(Typography.bodySmall)
                                .foregroundColor(.textSecondary)
                            
                            Picker("Category", selection: $viewModel.newEntityCategory) {
                                ForEach([EntityCategory.supplier, .partner, .subsidiary, .other], id: \\.self) { category in
                                    Text(category.rawValue).tag(category)
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
                            title: "Create Entity",
                            action: { viewModel.addEntity() }
                        )
                        
                        Spacer()
                    }
                    .padding(Spacing.lg)
                }
            }
            .navigationTitle("Add Wallet Tag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Entity Detail View
struct EntityDetailView: View {
    let entity: Entity
    @ObservedObject var viewModel: VendorManagementViewModel
    @Environment(\\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        // Entity Header
                        CardView {
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                HStack(spacing: Spacing.md) {
                                    Circle()
                                        .fill(Color.brandGreen.opacity(0.2))
                                        .frame(width: 64, height: 64)
                                        .overlay(
                                            Text(String(entity.name.prefix(1)))
                                                .font(Typography.heading2)
                                                .foregroundColor(.brandGreen)
                                        )
                                    
                                    VStack(alignment: .leading, spacing: Spacing.sm) {
                                        Text(entity.name)
                                            .font(Typography.heading3)
                                            .foregroundColor(.textPrimary)
                                        
                                        Text(entity.category.rawValue)
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textSecondary)
                                    }
                                    
                                    Spacer()
                                }
                                
                                AddressDisplay(address: entity.address)
                            }
                        }
                        .padding(Spacing.md)
                        
                        // Statistics
                        VStack(spacing: Spacing.md) {
                            HStack(spacing: Spacing.md) {
                                MetricCard(
                                    title: "Total Paid",
                                    value: formatCurrency(entity.totalPaid),
                                    subtitle: nil,
                                    icon: "dollarsign.circle.fill"
                                )
                                
                                MetricCard(
                                    title: "Transactions",
                                    value: "\\(entity.transactionCount)",
                                    subtitle: nil,
                                    icon: "arrow.left.arrow.right.circle.fill"
                                )
                            }
                            
                            MetricCard(
                                title: "Health Score",
                                value: String(format: "%.1f%%", entity.healthScore),
                                subtitle: "Entity reliability",
                                icon: "heart.circle.fill",
                                valueColor: entity.healthScore > 80 ? .successGreen : .warningYellow
                            )
                        }
                        .padding(Spacing.md)
                        
                        // Actions
                        VStack(spacing: Spacing.md) {
                            PrimaryButton(
                                title: "Send Payment",
                                action: { }
                            )
                            
                            SecondaryButton(
                                title: "Delete",
                                action: {
                                    viewModel.deleteEntity(entity)
                                    dismiss()
                                }
                            )
                        }
                        .padding(Spacing.md)
                        
                        Spacer()
                    }
                }
            }
            .navigationTitle(entity.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func formatCurrency(_ value: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "$"
        return formatter.string(from: NSDecimalNumber(decimal: value)) ?? "$0.00"
    }
}

// MARK: - Transaction Detail View
struct TransactionDetailView: View {
    let transaction: Transaction
    @Environment(\\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.backgroundPrimary.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        // Status
                        CardView {
                            VStack(spacing: Spacing.md) {
                                HStack(spacing: Spacing.md) {
                                    Image(systemName: statusIcon)
                                        .font(.system(size: 32))
                                        .foregroundColor(statusColor)
                                    
                                    VStack(alignment: .leading, spacing: Spacing.xs) {
                                        Text(statusText)
                                            .font(Typography.heading4)
                                            .foregroundColor(.textPrimary)
                                        
                                        Text(transaction.timestamp.formatted())
                                            .font(Typography.bodySmall)
                                            .foregroundColor(.textSecondary)
                                    }
                                    
                                    Spacer()
                                }
                                
                                Divider()
                                    .background(Color.borderColor)
                                
                                Text("-\\(transaction.amount.description) \\(transaction.token)")
                                    .font(Typography.heading2)
                                    .fontWeight(.bold)
                                    .foregroundColor(statusColor)
                            }
                        }
                        .padding(Spacing.md)
                        
                        // Details
                        CardView {
                            VStack(spacing: Spacing.md) {
                                DetailRow(label: "From", value: transaction.from)
                                Divider().background(Color.borderColor)
                                DetailRow(label: "To", value: transaction.to)
                                Divider().background(Color.borderColor)
                                DetailRow(label: "Chain", value: transaction.chain)
                                Divider().background(Color.borderColor)
                                DetailRow(label: "Hash", value: transaction.hash)
                                
                                if let category = transaction.category {
                                    Divider().background(Color.borderColor)
                                    DetailRow(label: "Category", value: category)
                                }
                                
                                if let notes = transaction.notes {
                                    Divider().background(Color.borderColor)
                                    DetailRow(label: "Notes", value: notes)
                                }
                            }
                        }
                        .padding(Spacing.md)
                        
                        // Action
                        PrimaryButton(
                            title: "View on Explorer",
                            action: { openExplorer() },
                            icon: "link.circle.fill"
                        )
                        .padding(Spacing.md)
                        
                        Spacer()
                    }
                }
            }
            .navigationTitle("Transaction Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private var statusText: String {
        switch transaction.status {
        case .pending:
            return "Pending"
        case .completed:
            return "Completed"
        case .confirmed:
            return "Confirmed"
        case .failed:
            return "Failed"
        }
    }
    
    private var statusColor: Color {
        switch transaction.status {
        case .pending:
            return .warningYellow
        case .completed, .confirmed:
            return .successGreen
        case .failed:
            return .errorRed
        }
    }
    
    private var statusIcon: String {
        switch transaction.status {
        case .pending:
            return "clock.fill"
        case .completed, .confirmed:
            return "checkmark.circle.fill"
        case .failed:
            return "xmark.circle.fill"
        }
    }
    
    private func openExplorer() {
        let explorerUrl = "https://etherscan.io/tx/\\(transaction.hash)"
        if let url = URL(string: explorerUrl) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Detail Row
struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(Typography.bodySmall)
                .foregroundColor(.textSecondary)
            
            Spacer()
            
            Text(value)
                .font(Typography.bodySmall)
                .fontWeight(.medium)
                .foregroundColor(.textPrimary)
                .lineLimit(1)
        }
    }
}

#Preview {
    VendorsNetworkView()
}
