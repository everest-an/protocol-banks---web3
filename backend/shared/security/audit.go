package security

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// AuditEventType defines the type of audit event
type AuditEventType string

const (
	AuditEventLogin            AuditEventType = "LOGIN"
	AuditEventLogout           AuditEventType = "LOGOUT"
	AuditEventPayoutCreated    AuditEventType = "PAYOUT_CREATED"
	AuditEventPayoutExecuted   AuditEventType = "PAYOUT_EXECUTED"
	AuditEventPayoutFailed     AuditEventType = "PAYOUT_FAILED"
	AuditEventPayoutCancelled  AuditEventType = "PAYOUT_CANCELLED"
	AuditEventMultisigCreated  AuditEventType = "MULTISIG_CREATED"
	AuditEventMultisigSigned   AuditEventType = "MULTISIG_SIGNED"
	AuditEventMultisigExecuted AuditEventType = "MULTISIG_EXECUTED"
	AuditEventWebhookReceived  AuditEventType = "WEBHOOK_RECEIVED"
	AuditEventWebhookFailed    AuditEventType = "WEBHOOK_FAILED"
	AuditEventSecurityAlert    AuditEventType = "SECURITY_ALERT"
)

// AuditResult defines the result of an audited action
type AuditResult string

const (
	AuditResultSuccess AuditResult = "SUCCESS"
	AuditResultFailure AuditResult = "FAILURE"
	AuditResultDenied  AuditResult = "DENIED"
)

// AuditEvent represents an audit log entry
type AuditEvent struct {
	Timestamp   time.Time              `json:"timestamp"`
	EventType   AuditEventType         `json:"event_type"`
	UserID      string                 `json:"user_id,omitempty"`
	Action      string                 `json:"action"`
	Resource    string                 `json:"resource"`
	ResourceID  string                 `json:"resource_id,omitempty"`
	IPAddress   string                 `json:"ip_address,omitempty"`
	UserAgent   string                 `json:"user_agent,omitempty"`
	RequestID   string                 `json:"request_id,omitempty"`
	Result      AuditResult            `json:"result"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

// AuditLogger handles audit logging
type AuditLogger struct {
	logger *slog.Logger
	// In production, this would write to an append-only store
	// like S3, CloudWatch Logs, or a dedicated audit database
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(logger *slog.Logger) *AuditLogger {
	return &AuditLogger{
		logger: logger.With("component", "audit"),
	}
}

// Log records an audit event
func (a *AuditLogger) Log(ctx context.Context, event AuditEvent) error {
	event.Timestamp = time.Now().UTC()

	// Extract request ID from context if available
	if reqID, ok := ctx.Value("request_id").(string); ok && event.RequestID == "" {
		event.RequestID = reqID
	}

	// Serialize to JSON for structured logging
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal audit event: %w", err)
	}

	// Log to structured logger
	a.logger.Info("audit_event",
		"event_type", event.EventType,
		"user_id", event.UserID,
		"resource", event.Resource,
		"resource_id", event.ResourceID,
		"result", event.Result,
		"raw", string(data),
	)

	// In production, also write to append-only storage
	// Examples:
	// - AWS CloudWatch Logs with retention policy
	// - S3 with Object Lock (WORM)
	// - Dedicated audit database with no DELETE permissions

	return nil
}

// LogPayout logs a payout-related event
func (a *AuditLogger) LogPayout(ctx context.Context, userID, batchID string, result AuditResult, details map[string]interface{}) {
	a.Log(ctx, AuditEvent{
		EventType:  AuditEventPayoutCreated,
		UserID:     userID,
		Action:     "CREATE_BATCH_PAYOUT",
		Resource:   "batch_payout",
		ResourceID: batchID,
		Result:     result,
		Details:    details,
	})
}

// LogWebhook logs a webhook event
func (a *AuditLogger) LogWebhook(ctx context.Context, source, eventID string, result AuditResult, details map[string]interface{}) {
	a.Log(ctx, AuditEvent{
		EventType:  AuditEventWebhookReceived,
		Action:     "PROCESS_WEBHOOK",
		Resource:   "webhook",
		ResourceID: eventID,
		Result:     result,
		Details:    details,
	})
}

// LogSecurityAlert logs a security-related event
func (a *AuditLogger) LogSecurityAlert(ctx context.Context, alertType string, details map[string]interface{}) {
	a.Log(ctx, AuditEvent{
		EventType: AuditEventSecurityAlert,
		Action:    alertType,
		Resource:  "security",
		Result:    AuditResultFailure,
		Details:   details,
	})
}
