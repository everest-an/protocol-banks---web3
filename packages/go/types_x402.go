package protocolbanks

import (
	"time"
)

// ============================================================================
// x402 Gasless Payment Types
// ============================================================================

// X402Status represents the status of an x402 authorization.
type X402Status string

const (
	X402StatusPending   X402Status = "pending"
	X402StatusSigned    X402Status = "signed"
	X402StatusSubmitted X402Status = "submitted"
	X402StatusExecuted  X402Status = "executed"
	X402StatusFailed    X402Status = "failed"
	X402StatusExpired   X402Status = "expired"
	X402StatusCancelled X402Status = "cancelled"
)

// EIP712Domain represents an EIP-712 domain.
type EIP712Domain struct {
	Name              string
	Version           string
	ChainID           int
	VerifyingContract string
}

// EIP712TypeField represents a field in an EIP-712 type.
type EIP712TypeField struct {
	Name string
	Type string
}

// EIP712Types represents EIP-712 type definitions.
type EIP712Types map[string][]EIP712TypeField

// TransferWithAuthorizationMessage represents the ERC-3009 message.
type TransferWithAuthorizationMessage struct {
	From        string
	To          string
	Value       string
	ValidAfter  int64
	ValidBefore int64
	Nonce       string
}

// X402AuthorizationParams holds parameters for creating an x402 authorization.
type X402AuthorizationParams struct {
	To       string
	Amount   string
	Token    TokenSymbol
	ChainID  int
	ValidFor int // Seconds, default: 3600
}

// X402Authorization represents an x402 authorization.
type X402Authorization struct {
	ID              string
	Domain          EIP712Domain
	Types           EIP712Types
	Message         TransferWithAuthorizationMessage
	Status          X402Status
	TransactionHash string
	CreatedAt       time.Time
	ExpiresAt       time.Time
	Signature       string
	RelayerFee      string
}

// ============================================================================
// Batch Payment Types
// ============================================================================

// BatchRecipient represents a recipient in a batch payment.
type BatchRecipient struct {
	Address string
	Amount  string
	Token   TokenSymbol
	Memo    string
	OrderID string
}

// BatchValidationError represents a validation error for a batch recipient.
type BatchValidationError struct {
	Index   int
	Address string
	Errors  []string
}

// BatchItemStatus represents the status of a batch item.
type BatchItemStatus struct {
	Index           int
	Address         string
	Amount          string
	Status          string // pending, processing, completed, failed
	TransactionHash string
	Error           string
}

// BatchPriority represents batch processing priority.
type BatchPriority string

const (
	BatchPriorityLow    BatchPriority = "low"
	BatchPriorityMedium BatchPriority = "medium"
	BatchPriorityHigh   BatchPriority = "high"
)

// BatchOptions holds options for batch submission.
type BatchOptions struct {
	Chain          ChainID
	Priority       BatchPriority
	WebhookURL     string
	IdempotencyKey string
}

// BatchSubmitResult represents the result of a batch submission.
type BatchSubmitResult struct {
	BatchID      string
	Status       string // pending, processing, completed, failed
	ValidCount   int
	InvalidCount int
	Errors       []BatchValidationError
	EstimatedFee string
}

// BatchProgress represents batch processing progress.
type BatchProgress struct {
	Total     int
	Completed int
	Failed    int
	Pending   int
}

// BatchStatus represents the status of a batch.
type BatchStatus struct {
	BatchID     string
	Status      string
	Progress    BatchProgress
	Items       []BatchItemStatus
	TotalAmount string
	TotalFee    string
	CreatedAt   time.Time
	CompletedAt *time.Time
}

// ============================================================================
// Webhook Types
// ============================================================================

// WebhookEventType represents webhook event types.
type WebhookEventType string

const (
	WebhookPaymentCreated   WebhookEventType = "payment.created"
	WebhookPaymentCompleted WebhookEventType = "payment.completed"
	WebhookPaymentFailed    WebhookEventType = "payment.failed"
	WebhookPaymentExpired   WebhookEventType = "payment.expired"
	WebhookBatchCreated     WebhookEventType = "batch.created"
	WebhookBatchProcessing  WebhookEventType = "batch.processing"
	WebhookBatchCompleted   WebhookEventType = "batch.completed"
	WebhookBatchFailed      WebhookEventType = "batch.failed"
	WebhookX402Created      WebhookEventType = "x402.created"
	WebhookX402Signed       WebhookEventType = "x402.signed"
	WebhookX402Executed     WebhookEventType = "x402.executed"
	WebhookX402Failed       WebhookEventType = "x402.failed"
	WebhookX402Expired      WebhookEventType = "x402.expired"
)

// WebhookEvent represents a webhook event.
type WebhookEvent struct {
	ID        string
	Type      WebhookEventType
	Timestamp time.Time
	Data      map[string]interface{}
	Signature string
}

// WebhookVerificationResult represents the result of webhook verification.
type WebhookVerificationResult struct {
	Valid          bool
	Event          *WebhookEvent
	Error          string
	TimestampValid bool
}
