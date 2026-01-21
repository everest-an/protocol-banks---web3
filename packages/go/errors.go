package protocolbanks

import (
	"fmt"
	"time"
)

// ============================================================================
// Error Types
// ============================================================================

// ErrorCategory represents error categories.
type ErrorCategory string

const (
	ErrorCategoryAuth   ErrorCategory = "AUTH"   // Authentication errors
	ErrorCategoryLink   ErrorCategory = "LINK"   // Payment link errors
	ErrorCategoryX402   ErrorCategory = "X402"   // x402 protocol errors
	ErrorCategoryBatch  ErrorCategory = "BATCH"  // Batch payment errors
	ErrorCategoryNet    ErrorCategory = "NET"    // Network errors
	ErrorCategoryRate   ErrorCategory = "RATE"   // Rate limit errors
	ErrorCategoryValid  ErrorCategory = "VALID"  // Validation errors
	ErrorCategoryCrypto ErrorCategory = "CRYPTO" // Cryptography errors
	ErrorCategoryChain  ErrorCategory = "CHAIN"  // Blockchain errors
)

// Error codes following the pattern PB_{CATEGORY}_{NNN}
const (
	// Authentication errors (PB_AUTH_xxx)
	ErrAuthInvalidAPIKey            = "PB_AUTH_001"
	ErrAuthInvalidSecret            = "PB_AUTH_002"
	ErrAuthTokenExpired             = "PB_AUTH_003"
	ErrAuthTokenInvalid             = "PB_AUTH_004"
	ErrAuthInsufficientPermissions  = "PB_AUTH_005"

	// Payment link errors (PB_LINK_xxx)
	ErrLinkInvalidAddress    = "PB_LINK_001"
	ErrLinkInvalidAmount     = "PB_LINK_002"
	ErrLinkInvalidToken      = "PB_LINK_003"
	ErrLinkInvalidChain      = "PB_LINK_004"
	ErrLinkExpired           = "PB_LINK_005"
	ErrLinkTampered          = "PB_LINK_006"
	ErrLinkHomoglyphDetected = "PB_LINK_007"
	ErrLinkInvalidExpiry     = "PB_LINK_008"

	// x402 errors (PB_X402_xxx)
	ErrX402UnsupportedChain     = "PB_X402_001"
	ErrX402UnsupportedToken     = "PB_X402_002"
	ErrX402AuthorizationExpired = "PB_X402_003"
	ErrX402InvalidSignature     = "PB_X402_004"
	ErrX402NonceReused          = "PB_X402_005"
	ErrX402InsufficientBalance  = "PB_X402_006"
	ErrX402RelayerError         = "PB_X402_007"

	// Batch errors (PB_BATCH_xxx)
	ErrBatchSizeExceeded      = "PB_BATCH_001"
	ErrBatchValidationFailed  = "PB_BATCH_002"
	ErrBatchNotFound          = "PB_BATCH_003"
	ErrBatchAlreadyProcessing = "PB_BATCH_004"

	// Network errors (PB_NET_xxx)
	ErrNetConnectionFailed = "PB_NET_001"
	ErrNetTimeout          = "PB_NET_002"
	ErrNetDNSFailed        = "PB_NET_003"
	ErrNetSSLError         = "PB_NET_004"

	// Rate limit errors (PB_RATE_xxx)
	ErrRateLimitExceeded = "PB_RATE_001"
	ErrRateQuotaExceeded = "PB_RATE_002"

	// Validation errors (PB_VALID_xxx)
	ErrValidRequiredField = "PB_VALID_001"
	ErrValidInvalidFormat = "PB_VALID_002"
	ErrValidOutOfRange    = "PB_VALID_003"

	// Cryptography errors (PB_CRYPTO_xxx)
	ErrCryptoEncryptionFailed    = "PB_CRYPTO_001"
	ErrCryptoDecryptionFailed    = "PB_CRYPTO_002"
	ErrCryptoSignatureFailed     = "PB_CRYPTO_003"
	ErrCryptoKeyDerivationFailed = "PB_CRYPTO_004"

	// Chain errors (PB_CHAIN_xxx)
	ErrChainUnsupported       = "PB_CHAIN_001"
	ErrChainRPCError          = "PB_CHAIN_002"
	ErrChainTransactionFailed = "PB_CHAIN_003"
)

// SDKError represents an SDK error.
type SDKError struct {
	Code       string
	Category   ErrorCategory
	Message    string
	Details    interface{}
	Retryable  bool
	RetryAfter time.Duration
	Timestamp  time.Time
	RequestID  string
}

// Error implements the error interface.
func (e *SDKError) Error() string {
	return fmt.Sprintf("[%s] %s: %s", e.Code, e.Category, e.Message)
}

// NewSDKError creates a new SDK error.
func NewSDKError(code string, category ErrorCategory, message string) *SDKError {
	return &SDKError{
		Code:      code,
		Category:  category,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// WithDetails adds details to the error.
func (e *SDKError) WithDetails(details interface{}) *SDKError {
	e.Details = details
	return e
}

// WithRetryable marks the error as retryable.
func (e *SDKError) WithRetryable(retryable bool) *SDKError {
	e.Retryable = retryable
	return e
}

// WithRetryAfter sets the retry-after duration.
func (e *SDKError) WithRetryAfter(d time.Duration) *SDKError {
	e.RetryAfter = d
	return e
}

// WithRequestID sets the request ID.
func (e *SDKError) WithRequestID(id string) *SDKError {
	e.RequestID = id
	return e
}

// IsRetryable returns whether the error is retryable.
func (e *SDKError) IsRetryable() bool {
	return e.Retryable
}

// ============================================================================
// Error Constructors
// ============================================================================

// NewValidationError creates a validation error.
func NewValidationError(message string) *SDKError {
	return NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid, message)
}

// NewAuthError creates an authentication error.
func NewAuthError(message string) *SDKError {
	return NewSDKError(ErrAuthInvalidAPIKey, ErrorCategoryAuth, message)
}

// NewNetworkError creates a network error.
func NewNetworkError(message string) *SDKError {
	return NewSDKError(ErrNetConnectionFailed, ErrorCategoryNet, message).WithRetryable(true)
}

// NewRateLimitError creates a rate limit error.
func NewRateLimitError(retryAfter time.Duration) *SDKError {
	return NewSDKError(ErrRateLimitExceeded, ErrorCategoryRate, "Rate limit exceeded").
		WithRetryable(true).
		WithRetryAfter(retryAfter)
}
