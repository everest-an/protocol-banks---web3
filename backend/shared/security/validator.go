package security

import (
	"fmt"
	"math/big"
	"regexp"
	"strings"
)

var (
	// Ethereum address regex
	ethAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)
	
	// Common attack patterns to block
	sqlInjectionPatterns = []string{
		"--",
		";--",
		"/*",
		"*/",
		"@@",
		"char(",
		"nchar(",
		"varchar(",
		"nvarchar(",
		"alter ",
		"begin ",
		"cast(",
		"create ",
		"cursor ",
		"declare ",
		"delete ",
		"drop ",
		"end ",
		"exec(",
		"execute(",
		"fetch ",
		"insert ",
		"kill ",
		"open ",
		"select ",
		"sys.",
		"sysobjects",
		"syscolumns",
		"table ",
		"update ",
		"union ",
		"xp_",
	}
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidateEthAddress validates an Ethereum address
func ValidateEthAddress(address string) error {
	if address == "" {
		return &ValidationError{Field: "address", Message: "address is required"}
	}
	
	if !ethAddressRegex.MatchString(address) {
		return &ValidationError{Field: "address", Message: "invalid Ethereum address format"}
	}
	
	// Check for zero address
	if address == "0x0000000000000000000000000000000000000000" {
		return &ValidationError{Field: "address", Message: "zero address is not allowed"}
	}
	
	return nil
}

// ValidateAmount validates a token amount
func ValidateAmount(amount string) error {
	if amount == "" {
		return &ValidationError{Field: "amount", Message: "amount is required"}
	}
	
	// Parse as big int
	val, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return &ValidationError{Field: "amount", Message: "invalid amount format"}
	}
	
	// Must be positive
	if val.Sign() <= 0 {
		return &ValidationError{Field: "amount", Message: "amount must be positive"}
	}
	
	// Sanity check: shouldn't be astronomically large (> 10^30)
	maxAmount := new(big.Int).Exp(big.NewInt(10), big.NewInt(30), nil)
	if val.Cmp(maxAmount) > 0 {
		return &ValidationError{Field: "amount", Message: "amount exceeds maximum allowed"}
	}
	
	return nil
}

// ValidateChainID validates a chain ID
func ValidateChainID(chainID int64) error {
	supportedChains := map[int64]bool{
		1:     true, // Ethereum
		137:   true, // Polygon
		42161: true, // Arbitrum
		8453:  true, // Base
		10:    true, // Optimism
		56:    true, // BNB Chain
	}
	
	if !supportedChains[chainID] {
		return &ValidationError{Field: "chain_id", Message: "unsupported chain"}
	}
	
	return nil
}

// SanitizeInput sanitizes user input to prevent injection attacks
func SanitizeInput(input string) (string, error) {
	// Check for SQL injection patterns
	lowerInput := strings.ToLower(input)
	for _, pattern := range sqlInjectionPatterns {
		if strings.Contains(lowerInput, pattern) {
			return "", &ValidationError{
				Field:   "input",
				Message: "potentially malicious input detected",
			}
		}
	}
	
	// Trim whitespace
	return strings.TrimSpace(input), nil
}

// ValidateBatchSize validates the batch size
func ValidateBatchSize(size int, maxAllowed int) error {
	if size <= 0 {
		return &ValidationError{Field: "batch_size", Message: "batch size must be positive"}
	}
	
	if size > maxAllowed {
		return &ValidationError{
			Field:   "batch_size",
			Message: fmt.Sprintf("batch size exceeds maximum of %d", maxAllowed),
		}
	}
	
	return nil
}

// ValidateWebhookTimestamp validates webhook timestamp for replay attack prevention
func ValidateWebhookTimestamp(timestamp int64, maxAgeSeconds int64) error {
	if timestamp == 0 {
		return &ValidationError{Field: "timestamp", Message: "timestamp is required"}
	}
	
	now := time.Now().Unix()
	age := now - timestamp
	
	// Too old
	if age > maxAgeSeconds {
		return &ValidationError{Field: "timestamp", Message: "timestamp is too old"}
	}
	
	// Too far in the future (clock skew tolerance: 60 seconds)
	if age < -60 {
		return &ValidationError{Field: "timestamp", Message: "timestamp is in the future"}
	}
	
	return nil
}

import "time"
