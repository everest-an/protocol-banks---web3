// Package protocolbanks provides a Go SDK for ProtocolBanks payment services.
//
// 支持多链、多币种的加密货币收单 SDK
// Supports multiple chains and tokens for cryptocurrency payment collection.
package protocolbanks

import (
	"time"
)

// ============================================================================
// Chain & Token Types
// ============================================================================

// ChainID represents a supported blockchain network.
type ChainID interface {
	isChainID()
}

// NumericChainID represents EVM chain IDs.
type NumericChainID int

func (NumericChainID) isChainID() {}

// StringChainID represents non-EVM chain identifiers.
type StringChainID string

func (StringChainID) isChainID() {}

// Supported chain IDs
const (
	ChainEthereum NumericChainID = 1
	ChainPolygon  NumericChainID = 137
	ChainBase     NumericChainID = 8453
	ChainArbitrum NumericChainID = 42161
	ChainOptimism NumericChainID = 10
	ChainBSC      NumericChainID = 56
)

// Non-EVM chains
const (
	ChainSolana  StringChainID = "solana"
	ChainBitcoin StringChainID = "bitcoin"
)

// TokenSymbol represents supported token symbols.
type TokenSymbol string

// Supported tokens
const (
	TokenUSDC  TokenSymbol = "USDC"
	TokenUSDT  TokenSymbol = "USDT"
	TokenDAI   TokenSymbol = "DAI"
	TokenETH   TokenSymbol = "ETH"
	TokenMATIC TokenSymbol = "MATIC"
	TokenBNB   TokenSymbol = "BNB"
	TokenSOL   TokenSymbol = "SOL"
	TokenBTC   TokenSymbol = "BTC"
)

// Environment represents the SDK environment.
type Environment string

const (
	EnvProduction Environment = "production"
	EnvSandbox    Environment = "sandbox"
	EnvTestnet    Environment = "testnet"
)

// ChainConfig holds configuration for a blockchain network.
type ChainConfig struct {
	ID             ChainID
	Name           string
	NativeCurrency TokenSymbol
	RPCURL         string
	ExplorerURL    string
	Tokens         []TokenConfig
	IsTestnet      bool
}

// TokenConfig holds configuration for a token.
type TokenConfig struct {
	Symbol          TokenSymbol
	Name            string
	Address         string // Contract address or "native"
	Decimals        int
	SupportsGasless bool // x402 support
	MinAmount       string
	MaxAmount       string
}

// ============================================================================
// SDK Configuration Types
// ============================================================================

// RetryConfig holds retry configuration.
type RetryConfig struct {
	MaxRetries        int
	InitialDelay      time.Duration
	MaxDelay          time.Duration
	BackoffMultiplier float64
}

// DefaultRetryConfig returns the default retry configuration.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:        3,
		InitialDelay:      time.Second,
		MaxDelay:          30 * time.Second,
		BackoffMultiplier: 2.0,
	}
}

// Config holds the main SDK configuration.
type Config struct {
	APIKey          string
	APISecret       string
	Environment     Environment
	BaseURL         string
	Timeout         time.Duration
	RetryConfig     *RetryConfig
	DefaultChain    ChainID
	SupportedChains []ChainID
	SupportedTokens []TokenSymbol
}

// ============================================================================
// Payment Link Types
// ============================================================================

// PaymentLinkParams holds parameters for generating a payment link.
type PaymentLinkParams struct {
	To            string            // Recipient address
	Amount        string            // Amount in token units
	Token         TokenSymbol       // Default: USDC
	Chain         ChainID           // Specific chain
	ExpiryHours   int               // Default: 24, max: 168
	Memo          string            // Optional reference (max 256 chars)
	OrderID       string            // Merchant order ID
	CallbackURL   string            // Redirect URL after payment
	WebhookURL    string            // Webhook notification URL
	AllowedChains []ChainID         // Allowed chains for payer
	AllowedTokens []TokenSymbol     // Allowed tokens for payer
	Metadata      map[string]string // Custom metadata
}

// PaymentLink represents a generated payment link.
type PaymentLink struct {
	URL       string
	ShortURL  string
	Params    PaymentLinkParams
	Signature string
	ExpiresAt time.Time
	CreatedAt time.Time
	PaymentID string
}

// HomoglyphDetails holds details about detected homoglyph attacks.
type HomoglyphDetails struct {
	OriginalAddress    string
	DetectedCharacters []DetectedCharacter
}

// DetectedCharacter represents a detected homoglyph character.
type DetectedCharacter struct {
	Position          int
	Character         string
	UnicodePoint      string
	ExpectedCharacter string
}

// LinkVerificationResult holds the result of payment link verification.
type LinkVerificationResult struct {
	Valid            bool
	Expired          bool
	TamperedFields   []string
	Params           *PaymentLinkParams
	Error            string
	HomoglyphDetected bool
	HomoglyphDetails *HomoglyphDetails
}

// ============================================================================
// QR Code Types
// ============================================================================

// QRErrorCorrection represents QR code error correction levels.
type QRErrorCorrection string

const (
	QRErrorCorrectionL QRErrorCorrection = "L"
	QRErrorCorrectionM QRErrorCorrection = "M"
	QRErrorCorrectionQ QRErrorCorrection = "Q"
	QRErrorCorrectionH QRErrorCorrection = "H"
)

// QRFormat represents QR code output formats.
type QRFormat string

const (
	QRFormatSVG     QRFormat = "svg"
	QRFormatPNG     QRFormat = "png"
	QRFormatBase64  QRFormat = "base64"
	QRFormatDataURL QRFormat = "dataUrl"
)

// QROptions holds options for QR code generation.
type QROptions struct {
	Size            int               // 100-1000 pixels
	Format          QRFormat          // Output format
	ErrorCorrection QRErrorCorrection // Error correction level
	Logo            string            // Logo URL or base64
	LogoSize        float64           // 0.1-0.3 ratio
	Foreground      string            // Hex color
	Background      string            // Hex color
	Margin          int               // Quiet zone modules
}

// DefaultQROptions returns the default QR options.
func DefaultQROptions() QROptions {
	return QROptions{
		Size:            300,
		Format:          QRFormatSVG,
		ErrorCorrection: QRErrorCorrectionM,
		LogoSize:        0.2,
		Foreground:      "#000000",
		Background:      "#ffffff",
		Margin:          4,
	}
}

// QRCode represents a generated QR code.
type QRCode struct {
	Data        string
	Format      QRFormat
	Size        int
	PaymentLink string
}
