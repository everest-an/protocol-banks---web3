package protocolbanks

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// ============================================================================
// Address Validation
// ============================================================================

var (
	// Ethereum address pattern: 0x followed by 40 hex characters
	ethAddressPattern = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

	// Solana address pattern: Base58 encoded, 32-44 characters
	solanaAddressPattern = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,44}$`)

	// Bitcoin address patterns
	btcLegacyPattern  = regexp.MustCompile(`^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$`)
	btcSegwitPattern  = regexp.MustCompile(`^bc1[a-zA-HJ-NP-Z0-9]{25,89}$`)
	btcTaprootPattern = regexp.MustCompile(`^bc1p[a-zA-HJ-NP-Z0-9]{58}$`)
)

// Cyrillic homoglyphs that look like Latin characters
var cyrillicHomoglyphs = map[rune]rune{
	'а': 'a', // Cyrillic а
	'е': 'e', // Cyrillic е
	'о': 'o', // Cyrillic о
	'р': 'p', // Cyrillic р
	'с': 'c', // Cyrillic с
	'х': 'x', // Cyrillic х
	'А': 'A', // Cyrillic А
	'В': 'B', // Cyrillic В
	'Е': 'E', // Cyrillic Е
	'К': 'K', // Cyrillic К
	'М': 'M', // Cyrillic М
	'Н': 'H', // Cyrillic Н
	'О': 'O', // Cyrillic О
	'Р': 'P', // Cyrillic Р
	'С': 'C', // Cyrillic С
	'Т': 'T', // Cyrillic Т
	'Х': 'X', // Cyrillic Х
}

// IsValidEthereumAddress checks if an address is a valid Ethereum address.
func IsValidEthereumAddress(address string) bool {
	return ethAddressPattern.MatchString(address)
}

// IsValidSolanaAddress checks if an address is a valid Solana address.
func IsValidSolanaAddress(address string) bool {
	return solanaAddressPattern.MatchString(address)
}

// IsValidBitcoinAddress checks if an address is a valid Bitcoin address.
func IsValidBitcoinAddress(address string) bool {
	return btcLegacyPattern.MatchString(address) ||
		btcSegwitPattern.MatchString(address) ||
		btcTaprootPattern.MatchString(address)
}

// IsValidAddress checks if an address is valid for any supported chain.
func IsValidAddress(address string) bool {
	return IsValidEthereumAddress(address) ||
		IsValidSolanaAddress(address) ||
		IsValidBitcoinAddress(address)
}

// IsValidAddressForChain checks if an address is valid for a specific chain.
func IsValidAddressForChain(address string, chain ChainID) bool {
	switch chain {
	case ChainSolana:
		return IsValidSolanaAddress(address)
	case ChainBitcoin:
		return IsValidBitcoinAddress(address)
	default:
		// EVM chains
		return IsValidEthereumAddress(address)
	}
}

// ValidateAddress validates an address and returns an error if invalid.
func ValidateAddress(address string, chain ChainID) error {
	if address == "" {
		return NewSDKError(ErrLinkInvalidAddress, ErrorCategoryLink, "Address is required")
	}

	// Check for homoglyphs first
	if details := DetectHomoglyphs(address); details != nil {
		return NewSDKError(ErrLinkHomoglyphDetected, ErrorCategoryLink,
			"Address contains suspicious characters (possible homoglyph attack)").
			WithDetails(details)
	}

	if chain != nil && !IsValidAddressForChain(address, chain) {
		return NewSDKError(ErrLinkInvalidAddress, ErrorCategoryLink,
			"Invalid address format for chain")
	}

	if chain == nil && !IsValidAddress(address) {
		return NewSDKError(ErrLinkInvalidAddress, ErrorCategoryLink,
			"Invalid address format")
	}

	return nil
}

// ============================================================================
// Homoglyph Detection
// ============================================================================

// DetectHomoglyphs detects Cyrillic homoglyphs in an address.
func DetectHomoglyphs(address string) *HomoglyphDetails {
	var detected []DetectedCharacter

	for i, r := range address {
		if expected, ok := cyrillicHomoglyphs[r]; ok {
			detected = append(detected, DetectedCharacter{
				Position:          i,
				Character:         string(r),
				UnicodePoint:      "U+" + strconv.FormatInt(int64(r), 16),
				ExpectedCharacter: string(expected),
			})
		}
	}

	if len(detected) == 0 {
		return nil
	}

	return &HomoglyphDetails{
		OriginalAddress:    address,
		DetectedCharacters: detected,
	}
}

// ============================================================================
// Amount Validation
// ============================================================================

// IsValidAmount checks if an amount is valid.
func IsValidAmount(amount string) bool {
	if amount == "" {
		return false
	}

	// Parse as float
	val, err := strconv.ParseFloat(amount, 64)
	if err != nil {
		return false
	}

	// Must be positive and not exceed max
	return val > 0 && val <= MaxAmount
}

// ValidateAmount validates an amount and returns an error if invalid.
func ValidateAmount(amount string) error {
	if amount == "" {
		return NewSDKError(ErrLinkInvalidAmount, ErrorCategoryLink, "Amount is required")
	}

	val, err := strconv.ParseFloat(amount, 64)
	if err != nil {
		return NewSDKError(ErrLinkInvalidAmount, ErrorCategoryLink, "Invalid amount format")
	}

	if val <= 0 {
		return NewSDKError(ErrLinkInvalidAmount, ErrorCategoryLink, "Amount must be positive")
	}

	if val > MaxAmount {
		return NewSDKError(ErrLinkInvalidAmount, ErrorCategoryLink,
			"Amount exceeds maximum of 1 billion")
	}

	return nil
}

// ============================================================================
// Token Validation
// ============================================================================

// SupportedTokens returns all supported token symbols.
func SupportedTokens() []TokenSymbol {
	return []TokenSymbol{
		TokenUSDC, TokenUSDT, TokenDAI, TokenETH,
		TokenMATIC, TokenBNB, TokenSOL, TokenBTC,
	}
}

// IsValidToken checks if a token is supported.
func IsValidToken(token TokenSymbol) bool {
	for _, t := range SupportedTokens() {
		if t == token {
			return true
		}
	}
	return false
}

// ValidateToken validates a token and returns an error if invalid.
func ValidateToken(token TokenSymbol) error {
	if token == "" {
		return NewSDKError(ErrLinkInvalidToken, ErrorCategoryLink, "Token is required")
	}

	if !IsValidToken(token) {
		return NewSDKError(ErrLinkInvalidToken, ErrorCategoryLink,
			"Unsupported token: "+string(token))
	}

	return nil
}

// ============================================================================
// Chain Validation
// ============================================================================

// IsValidChainID checks if a chain ID is supported.
func IsValidChainID(chain ChainID) bool {
	for _, c := range SupportedChains() {
		if c == chain {
			return true
		}
	}
	return false
}

// ValidateChainID validates a chain ID and returns an error if invalid.
func ValidateChainID(chain ChainID) error {
	if chain == nil {
		return nil // Chain is optional
	}

	if !IsValidChainID(chain) {
		return NewSDKError(ErrLinkInvalidChain, ErrorCategoryLink, "Unsupported chain")
	}

	return nil
}

// ============================================================================
// Expiry Validation
// ============================================================================

// IsValidExpiryHours checks if expiry hours is valid.
func IsValidExpiryHours(hours int) bool {
	return hours >= MinExpiryHours && hours <= MaxExpiryHours
}

// ValidateExpiryHours validates expiry hours and returns an error if invalid.
func ValidateExpiryHours(hours int) error {
	if hours < MinExpiryHours || hours > MaxExpiryHours {
		return NewSDKError(ErrLinkInvalidExpiry, ErrorCategoryLink,
			"Expiry hours must be between 1 and 168")
	}
	return nil
}

// IsExpired checks if a timestamp (milliseconds) is expired.
func IsExpired(expiryMs int64) bool {
	return time.Now().UnixMilli() > expiryMs
}

// ============================================================================
// Memo Validation
// ============================================================================

// IsValidMemo checks if a memo is valid.
func IsValidMemo(memo string) bool {
	return len(memo) <= MaxMemoLength
}

// ValidateMemo validates a memo and returns an error if invalid.
func ValidateMemo(memo string) error {
	if len(memo) > MaxMemoLength {
		return NewSDKError(ErrValidOutOfRange, ErrorCategoryValid,
			"Memo exceeds maximum length of 256 characters")
	}
	return nil
}

// ============================================================================
// Batch Validation
// ============================================================================

// ValidateBatchSize validates batch size and returns an error if invalid.
func ValidateBatchSize(size int) error {
	if size == 0 {
		return NewSDKError(ErrBatchValidationFailed, ErrorCategoryBatch,
			"Batch cannot be empty")
	}

	if size > MaxBatchSize {
		return NewSDKError(ErrBatchSizeExceeded, ErrorCategoryBatch,
			"Batch size exceeds maximum of 500")
	}

	return nil
}

// ============================================================================
// String Helpers
// ============================================================================

// ContainsNonASCII checks if a string contains non-ASCII characters.
func ContainsNonASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII {
			return true
		}
	}
	return false
}

// NormalizeAddress normalizes an address to lowercase.
func NormalizeAddress(address string) string {
	return strings.ToLower(address)
}
