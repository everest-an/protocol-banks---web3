package protocolbanks

import (
	"encoding/json"
	"strings"
	"time"
)

// ============================================================================
// Constants
// ============================================================================

const (
	// WebhookSignatureHeader is the header name for webhook signatures.
	WebhookSignatureHeader = "X-PB-Signature"

	// WebhookTimestampHeader is the header name for webhook timestamps.
	WebhookTimestampHeader = "X-PB-Timestamp"

	// DefaultTimestampTolerance is the default timestamp tolerance (5 minutes).
	DefaultTimestampTolerance = 300
)

// SupportedEventTypes returns all supported webhook event types.
var SupportedEventTypes = []WebhookEventType{
	WebhookPaymentCreated,
	WebhookPaymentCompleted,
	WebhookPaymentFailed,
	WebhookPaymentExpired,
	WebhookBatchCreated,
	WebhookBatchProcessing,
	WebhookBatchCompleted,
	WebhookBatchFailed,
	WebhookX402Created,
	WebhookX402Signed,
	WebhookX402Executed,
	WebhookX402Failed,
	WebhookX402Expired,
}

// ============================================================================
// Webhook Module
// ============================================================================

// WebhookModule handles webhook signature verification and event parsing.
type WebhookModule struct{}

// NewWebhookModule creates a new WebhookModule.
func NewWebhookModule() *WebhookModule {
	return &WebhookModule{}
}

// Verify verifies a webhook signature.
func (m *WebhookModule) Verify(payload, signature, secret string, tolerance int) *WebhookVerificationResult {
	if tolerance == 0 {
		tolerance = DefaultTimestampTolerance
	}

	// Parse signature header
	timestamp, sig, ok := ParseWebhookSignature(signature)
	if !ok {
		return &WebhookVerificationResult{
			Valid: false,
			Error: "Invalid signature format",
		}
	}

	// Check timestamp
	now := time.Now().Unix()
	if abs(now-timestamp) > int64(tolerance) {
		return &WebhookVerificationResult{
			Valid:          false,
			Error:          "Webhook timestamp is outside tolerance window",
			TimestampValid: false,
		}
	}

	// Verify signature
	if !VerifyWebhookSignature(payload, sig, secret, timestamp) {
		return &WebhookVerificationResult{
			Valid:          false,
			Error:          "Invalid webhook signature",
			TimestampValid: true,
		}
	}

	// Parse event
	event, err := m.Parse(payload)
	if err != nil {
		return &WebhookVerificationResult{
			Valid:          false,
			Error:          err.Error(),
			TimestampValid: true,
		}
	}

	return &WebhookVerificationResult{
		Valid:          true,
		Event:          event,
		TimestampValid: true,
	}
}

// Parse parses a webhook payload into an event.
func (m *WebhookModule) Parse(payload string) (*WebhookEvent, error) {
	var data struct {
		ID        string                 `json:"id"`
		Type      string                 `json:"type"`
		Timestamp interface{}            `json:"timestamp"`
		Data      map[string]interface{} `json:"data"`
		Signature string                 `json:"signature"`
	}

	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return nil, NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid,
			"Invalid webhook payload JSON")
	}

	// Validate required fields
	if data.ID == "" || data.Type == "" {
		return nil, NewSDKError(ErrValidRequiredField, ErrorCategoryValid,
			"Webhook payload missing required fields (id, type)")
	}

	// Validate event type
	if !m.IsValidEventType(data.Type) {
		return nil, NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid,
			"Unknown webhook event type: "+data.Type)
	}

	// Parse timestamp
	var timestamp time.Time
	switch t := data.Timestamp.(type) {
	case float64:
		timestamp = time.Unix(int64(t), 0)
	case string:
		var err error
		timestamp, err = time.Parse(time.RFC3339, t)
		if err != nil {
			timestamp = time.Now()
		}
	default:
		timestamp = time.Now()
	}

	return &WebhookEvent{
		ID:        data.ID,
		Type:      WebhookEventType(data.Type),
		Timestamp: timestamp,
		Data:      data.Data,
		Signature: data.Signature,
	}, nil
}

// Sign generates a webhook signature (for testing).
func (m *WebhookModule) Sign(payload, secret string, timestamp int64) string {
	if timestamp == 0 {
		timestamp = time.Now().Unix()
	}
	sig := GenerateWebhookSignature(payload, secret, timestamp)
	return FormatWebhookSignature(sig, timestamp)
}

// GetSupportedEventTypes returns all supported event types.
func (m *WebhookModule) GetSupportedEventTypes() []WebhookEventType {
	return SupportedEventTypes
}

// IsValidEventType checks if an event type is valid.
func (m *WebhookModule) IsValidEventType(eventType string) bool {
	for _, t := range SupportedEventTypes {
		if string(t) == eventType {
			return true
		}
	}
	return false
}

// ============================================================================
// Event Type Helpers
// ============================================================================

// IsPaymentEvent checks if an event is a payment event.
func IsPaymentEvent(event *WebhookEvent) bool {
	return strings.HasPrefix(string(event.Type), "payment.")
}

// IsBatchEvent checks if an event is a batch event.
func IsBatchEvent(event *WebhookEvent) bool {
	return strings.HasPrefix(string(event.Type), "batch.")
}

// IsX402Event checks if an event is an x402 event.
func IsX402Event(event *WebhookEvent) bool {
	return strings.HasPrefix(string(event.Type), "x402.")
}

// IsSuccessEvent checks if an event indicates success.
func IsSuccessEvent(event *WebhookEvent) bool {
	return strings.HasSuffix(string(event.Type), ".completed") ||
		strings.HasSuffix(string(event.Type), ".executed")
}

// IsFailureEvent checks if an event indicates failure.
func IsFailureEvent(event *WebhookEvent) bool {
	return strings.HasSuffix(string(event.Type), ".failed") ||
		strings.HasSuffix(string(event.Type), ".expired")
}

// ============================================================================
// Event Data Types
// ============================================================================

// PaymentEventData represents payment event data.
type PaymentEventData struct {
	PaymentID        string `json:"paymentId"`
	Amount           string `json:"amount"`
	Token            string `json:"token"`
	Chain            string `json:"chain"`
	RecipientAddress string `json:"recipientAddress"`
	SenderAddress    string `json:"senderAddress,omitempty"`
	TransactionHash  string `json:"transactionHash,omitempty"`
	OrderID          string `json:"orderId,omitempty"`
	Memo             string `json:"memo,omitempty"`
	Error            string `json:"error,omitempty"`
}

// BatchEventData represents batch event data.
type BatchEventData struct {
	BatchID         string `json:"batchId"`
	TotalRecipients int    `json:"totalRecipients"`
	CompletedCount  int    `json:"completedCount"`
	FailedCount     int    `json:"failedCount"`
	TotalAmount     string `json:"totalAmount"`
	Token           string `json:"token"`
	Chain           string `json:"chain"`
	Error           string `json:"error,omitempty"`
}

// X402EventData represents x402 event data.
type X402EventData struct {
	AuthorizationID string `json:"authorizationId"`
	Amount          string `json:"amount"`
	Token           string `json:"token"`
	ChainID         int    `json:"chainId"`
	FromAddress     string `json:"fromAddress"`
	ToAddress       string `json:"toAddress"`
	TransactionHash string `json:"transactionHash,omitempty"`
	RelayerFee      string `json:"relayerFee,omitempty"`
	Error           string `json:"error,omitempty"`
}

// ParsePaymentEvent parses payment event data.
func ParsePaymentEvent(event *WebhookEvent) (*PaymentEventData, error) {
	if !IsPaymentEvent(event) {
		return nil, NewValidationError("Not a payment event")
	}

	data := &PaymentEventData{}
	jsonData, _ := json.Marshal(event.Data)
	if err := json.Unmarshal(jsonData, data); err != nil {
		return nil, err
	}
	return data, nil
}

// ParseBatchEvent parses batch event data.
func ParseBatchEvent(event *WebhookEvent) (*BatchEventData, error) {
	if !IsBatchEvent(event) {
		return nil, NewValidationError("Not a batch event")
	}

	data := &BatchEventData{}
	jsonData, _ := json.Marshal(event.Data)
	if err := json.Unmarshal(jsonData, data); err != nil {
		return nil, err
	}
	return data, nil
}

// ParseX402Event parses x402 event data.
func ParseX402Event(event *WebhookEvent) (*X402EventData, error) {
	if !IsX402Event(event) {
		return nil, NewValidationError("Not an x402 event")
	}

	data := &X402EventData{}
	jsonData, _ := json.Marshal(event.Data)
	if err := json.Unmarshal(jsonData, data); err != nil {
		return nil, err
	}
	return data, nil
}

// ============================================================================
// Helper Functions
// ============================================================================

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}
