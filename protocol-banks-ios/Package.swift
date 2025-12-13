// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ProtocolBanksIOS",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "ProtocolBanksIOS",
            targets: ["ProtocolBanksIOS"]
        ),
    ],
    dependencies: [
        // Web3 Integration
        .package(url: "https://github.com/web3swift-team/web3swift.git", .upToNextMajor(from: "3.0.0")),
        
        // WalletConnect
        .package(url: "https://github.com/WalletConnect/WalletConnectSwiftV2.git", .upToNextMajor(from: "1.0.0")),
        
        // Networking
        .package(url: "https://github.com/Alamofire/Alamofire.git", .upToNextMajor(from: "5.0.0")),
        
        // JSON Encoding/Decoding
        .package(url: "https://github.com/SwiftyJSON/SwiftyJSON.git", .upToNextMajor(from: "5.0.0")),
        
        // Keychain
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", .upToNextMajor(from: "4.0.0")),
        
        // Charts
        .package(url: "https://github.com/danielgindi/Charts.git", .upToNextMajor(from: "5.0.0")),
    ],
    targets: [
        .target(
            name: "ProtocolBanksIOS",
            dependencies: [
                .product(name: "web3swift", package: "web3swift"),
                .product(name: "WalletConnectSwift", package: "WalletConnectSwiftV2"),
                .product(name: "Alamofire", package: "Alamofire"),
                .product(name: "SwiftyJSON", package: "SwiftyJSON"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "Charts", package: "Charts"),
            ],
            path: "Sources"
        ),
        .testTarget(
            name: "ProtocolBanksIOSTests",
            dependencies: ["ProtocolBanksIOS"],
            path: "Tests"
        ),
    ]
)
