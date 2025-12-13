import SwiftUI

// MARK: - Primary Button
struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isEnabled: Bool = true
    var icon: String? = nil
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else if let icon = icon {
                    Image(systemName: icon)
                }
                
                Text(title)
                    .font(Typography.bodyLarge)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.brandGreen)
            .foregroundColor(.white)
            .cornerRadius(CornerRadii.medium)
            .opacity(isEnabled ? 1.0 : 0.5)
        }
        .disabled(!isEnabled || isLoading)
    }
}

// MARK: - Secondary Button
struct SecondaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isEnabled: Bool = true
    var icon: String? = nil
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(.brandGreen)
                } else if let icon = icon {
                    Image(systemName: icon)
                }
                
                Text(title)
                    .font(Typography.bodyLarge)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md)
            .background(Color.backgroundSecondary)
            .foregroundColor(.brandGreen)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadii.medium)
                    .stroke(Color.brandGreen, lineWidth: 1.5)
            )
            .opacity(isEnabled ? 1.0 : 0.5)
        }
        .disabled(!isEnabled || isLoading)
    }
}

// MARK: - Card View
struct CardView<Content: View>: View {
    let content: Content
    var padding: CGFloat = Spacing.md
    var backgroundColor: Color = .backgroundSecondary
    
    init(padding: CGFloat = Spacing.md, backgroundColor: Color = .backgroundSecondary, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.backgroundColor = backgroundColor
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(padding)
        .background(backgroundColor)
        .cornerRadius(CornerRadii.large)
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadii.large)
                .stroke(Color.borderColor, lineWidth: 1)
        )
    }
}

// MARK: - Metric Card
struct MetricCard: View {
    let title: String
    let value: String
    let subtitle: String?
    let icon: String?
    var valueColor: Color = .brandGreen
    
    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.brandGreen)
                    }
                    
                    Text(title)
                        .font(Typography.bodySmall)
                        .foregroundColor(.textSecondary)
                    
                    Spacer()
                }
                
                Text(value)
                    .font(Typography.heading3)
                    .fontWeight(.bold)
                    .foregroundColor(valueColor)
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(Typography.captionSmall)
                        .foregroundColor(.textSecondary)
                }
            }
        }
    }
}

// MARK: - Input Field
struct InputField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var icon: String? = nil
    
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(label)
                .font(Typography.bodySmall)
                .foregroundColor(.textSecondary)
            
            HStack(spacing: Spacing.md) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundColor(.textSecondary)
                }
                
                if isSecure {
                    SecureField(placeholder, text: $text)
                        .font(Typography.bodyMedium)
                        .foregroundColor(.textPrimary)
                } else {
                    TextField(placeholder, text: $text)
                        .font(Typography.bodyMedium)
                        .foregroundColor(.textPrimary)
                        .keyboardType(keyboardType)
                }
            }
            .padding(Spacing.md)
            .background(Color.backgroundSecondary)
            .cornerRadius(CornerRadii.medium)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadii.medium)
                    .stroke(Color.borderColor, lineWidth: 1)
            )
        }
    }
}

// MARK: - Amount Input
struct AmountInputField: View {
    let label: String
    @Binding var amount: String
    let currency: String
    var icon: String? = nil
    
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(label)
                .font(Typography.bodySmall)
                .foregroundColor(.textSecondary)
            
            HStack(spacing: Spacing.md) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundColor(.textSecondary)
                }
                
                TextField("0.00", text: $amount)
                    .font(Typography.heading4)
                    .foregroundColor(.textPrimary)
                    .keyboardType(.decimalPad)
                
                Text(currency)
                    .font(Typography.bodyMedium)
                    .foregroundColor(.textSecondary)
            }
            .padding(Spacing.md)
            .background(Color.backgroundSecondary)
            .cornerRadius(CornerRadii.medium)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadii.medium)
                    .stroke(Color.borderColor, lineWidth: 1)
            )
        }
    }
}

// MARK: - Address Display
struct AddressDisplay: View {
    let address: String
    var showCopy: Bool = true
    
    var body: some View {
        HStack(spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Address")
                    .font(Typography.captionSmall)
                    .foregroundColor(.textSecondary)
                
                Text(formatAddress(address))
                    .font(Typography.bodySmall)
                    .fontWeight(.medium)
                    .foregroundColor(.textPrimary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            if showCopy {
                Button(action: { copyToClipboard(address) }) {
                    Image(systemName: "doc.on.doc")
                        .foregroundColor(.brandGreen)
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .cornerRadius(CornerRadii.medium)
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadii.medium)
                .stroke(Color.borderColor, lineWidth: 1)
        )
    }
    
    private func formatAddress(_ address: String) -> String {
        guard address.count > 10 else { return address }
        let start = address.prefix(6)
        let end = address.suffix(4)
        return "\\(start)...\\(end)"
    }
    
    private func copyToClipboard(_ text: String) {
        UIPasteboard.general.string = text
    }
}

// MARK: - Status Badge
struct StatusBadge: View {
    let status: TransactionStatus
    
    var statusColor: Color {
        switch status {
        case .pending:
            return .warningYellow
        case .completed:
            return .successGreen
        case .confirmed:
            return .successGreen
        case .failed:
            return .errorRed
        }
    }
    
    var statusText: String {
        switch status {
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
    
    var body: some View {
        HStack(spacing: Spacing.xs) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            
            Text(statusText)
                .font(Typography.captionSmall)
                .fontWeight(.medium)
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(statusColor.opacity(0.1))
        .cornerRadius(CornerRadii.small)
    }
}

// MARK: - Loading View
struct LoadingView: View {
    var body: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .tint(.brandGreen)
            
            Text("Loading...")
                .font(Typography.bodyMedium)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }
}

// MARK: - Error View
struct ErrorView: View {
    let message: String
    let action: (() -> Void)?
    
    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.errorRed)
            
            Text("Error")
                .font(Typography.heading4)
                .foregroundColor(.textPrimary)
            
            Text(message)
                .font(Typography.bodyMedium)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
            
            if let action = action {
                PrimaryButton(title: "Try Again", action: action)
            }
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let title: String
    let message: String
    let icon: String
    
    var body: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.textSecondary)
            
            Text(title)
                .font(Typography.heading4)
                .foregroundColor(.textPrimary)
            
            Text(message)
                .font(Typography.bodyMedium)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity)
    }
}
