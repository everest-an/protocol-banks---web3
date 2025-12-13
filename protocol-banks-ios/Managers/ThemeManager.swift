import SwiftUI

class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    
    @Published var isDarkMode: Bool = true
    @Published var accentColor: Color = .green
    
    private let storageManager = StorageManager.shared
    
    init() {
        loadThemePreferences()
    }
    
    private func loadThemePreferences() {
        isDarkMode = storageManager.loadBool(forKey: "isDarkMode") ?? true
    }
    
    func toggleDarkMode() {
        isDarkMode.toggle()
        storageManager.saveBool(isDarkMode, forKey: "isDarkMode")
    }
    
    func setAccentColor(_ color: Color) {
        accentColor = color
    }
}

// MARK: - Color Extensions
extension Color {
    // 品牌色
    static let brandGreen = Color(red: 0.2, green: 0.8, blue: 0.4)
    static let brandDark = Color(red: 0.05, green: 0.05, blue: 0.1)
    static let brandGray = Color(red: 0.3, green: 0.3, blue: 0.35)
    
    // 状态色
    static let successGreen = Color(red: 0.2, green: 0.8, blue: 0.4)
    static let warningYellow = Color(red: 1.0, green: 0.8, blue: 0.0)
    static let errorRed = Color(red: 1.0, green: 0.2, blue: 0.2)
    static let infoBlue = Color(red: 0.2, green: 0.6, blue: 1.0)
    
    // 中性色
    static let textPrimary = Color(red: 0.95, green: 0.95, blue: 0.95)
    static let textSecondary = Color(red: 0.7, green: 0.7, blue: 0.75)
    static let backgroundPrimary = Color(red: 0.08, green: 0.08, blue: 0.15)
    static let backgroundSecondary = Color(red: 0.12, green: 0.12, blue: 0.2)
    static let borderColor = Color(red: 0.2, green: 0.2, blue: 0.25)
}

// MARK: - Typography
struct Typography {
    // Heading styles
    static let heading1 = Font.system(size: 32, weight: .bold)
    static let heading2 = Font.system(size: 24, weight: .bold)
    static let heading3 = Font.system(size: 20, weight: .semibold)
    static let heading4 = Font.system(size: 16, weight: .semibold)
    
    // Body styles
    static let bodyLarge = Font.system(size: 16, weight: .regular)
    static let bodyMedium = Font.system(size: 14, weight: .regular)
    static let bodySmall = Font.system(size: 12, weight: .regular)
    
    // Caption styles
    static let captionLarge = Font.system(size: 12, weight: .medium)
    static let captionSmall = Font.system(size: 10, weight: .regular)
}

// MARK: - Spacing
struct Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius
struct CornerRadii {
    static let small: CGFloat = 4
    static let medium: CGFloat = 8
    static let large: CGFloat = 12
    static let extraLarge: CGFloat = 16
}

// MARK: - Shadow
struct ShadowStyle {
    static let small = Shadow(
        color: Color.black.opacity(0.1),
        radius: 4,
        x: 0,
        y: 2
    )
    
    static let medium = Shadow(
        color: Color.black.opacity(0.15),
        radius: 8,
        x: 0,
        y: 4
    )
    
    static let large = Shadow(
        color: Color.black.opacity(0.2),
        radius: 12,
        x: 0,
        y: 8
    )
}

struct Shadow {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}
