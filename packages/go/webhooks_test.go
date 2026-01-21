package protocolbanks

import (
	"encoding/json"
	"testing"
	"time"
)

func TestWebhookSign(t *testing.T) {
	module := NewWebhookModule()

	t.Run("generates valid signature", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","data":{}}`
		secret := "whsec_test123"
		timestamp := time.Now().Unix()

		signature := module.Sign(payload, secret, timestamp)

		if signature == "" {
			t.Error("expected signature to be set")
		}

		// Should contain timestamp and v1 signature
		if !containsSubstring(signature, "t=") {
			t.Error("expected signature to contain timestamp")
		}

		if !containsSubstring(signature, "v1=") {
			t.Error("expected signature to contain v1 signature")
		}
	})
}

func TestWebhookVerify(t *testing.T) {
	module := NewWebhookModule()

	t.Run("verifies valid signature", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","timestamp":1234567890,"data":{"paymentId":"pay_123"}}`
		secret := "whsec_test123"

		// Generate signature
		signature := module.Sign(payload, secret, 0)

		// Verify
		result := module.Verify(payload, signature, secret, 300)

		if !result.Valid {
			t.Errorf("expected valid result, got error: %s", result.Error)
		}

		if result.Event == nil {
			t.Error("expected event to be set")
		}

		if result.Event.ID != "evt_123" {
			t.Errorf("expected event ID to be evt_123, got %s", result.Event.ID)
		}

		if result.Event.Type != WebhookPaymentCompleted {
			t.Errorf("expected event type to be payment.completed, got %s", result.Event.Type)
		}
	})

	t.Run("rejects invalid signature", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","data":{}}`
		secret := "whsec_test123"

		result := module.Verify(payload, "t=123,v1=invalid", secret, 300)

		if result.Valid {
			t.Error("expected invalid result for wrong signature")
		}
	})

	t.Run("rejects expired timestamp", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","data":{}}`
		secret := "whsec_test123"

		// Generate signature with old timestamp
		oldTimestamp := time.Now().Add(-10 * time.Minute).Unix()
		signature := module.Sign(payload, secret, oldTimestamp)

		result := module.Verify(payload, signature, secret, 300) // 5 minute tolerance

		if result.Valid {
			t.Error("expected invalid result for expired timestamp")
		}

		if result.TimestampValid {
			t.Error("expected timestamp to be invalid")
		}
	})

	t.Run("rejects invalid signature format", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","data":{}}`
		secret := "whsec_test123"

		result := module.Verify(payload, "invalid-format", secret, 300)

		if result.Valid {
			t.Error("expected invalid result for bad format")
		}
	})
}

func TestWebhookParse(t *testing.T) {
	module := NewWebhookModule()

	t.Run("parses valid payload", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"payment.completed","timestamp":1234567890,"data":{"paymentId":"pay_123"}}`

		event, err := module.Parse(payload)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if event.ID != "evt_123" {
			t.Errorf("expected ID to be evt_123, got %s", event.ID)
		}

		if event.Type != WebhookPaymentCompleted {
			t.Errorf("expected type to be payment.completed, got %s", event.Type)
		}
	})

	t.Run("rejects missing required fields", func(t *testing.T) {
		payload := `{"data":{}}`

		_, err := module.Parse(payload)

		if err == nil {
			t.Error("expected error for missing required fields")
		}
	})

	t.Run("rejects unknown event type", func(t *testing.T) {
		payload := `{"id":"evt_123","type":"unknown.event","data":{}}`

		_, err := module.Parse(payload)

		if err == nil {
			t.Error("expected error for unknown event type")
		}
	})

	t.Run("rejects invalid JSON", func(t *testing.T) {
		payload := `not valid json`

		_, err := module.Parse(payload)

		if err == nil {
			t.Error("expected error for invalid JSON")
		}
	})
}

func TestEventTypeHelpers(t *testing.T) {
	t.Run("IsPaymentEvent", func(t *testing.T) {
		event := &WebhookEvent{Type: WebhookPaymentCompleted}
		if !IsPaymentEvent(event) {
			t.Error("expected payment.completed to be a payment event")
		}

		event = &WebhookEvent{Type: WebhookBatchCompleted}
		if IsPaymentEvent(event) {
			t.Error("expected batch.completed to not be a payment event")
		}
	})

	t.Run("IsBatchEvent", func(t *testing.T) {
		event := &WebhookEvent{Type: WebhookBatchCompleted}
		if !IsBatchEvent(event) {
			t.Error("expected batch.completed to be a batch event")
		}

		event = &WebhookEvent{Type: WebhookPaymentCompleted}
		if IsBatchEvent(event) {
			t.Error("expected payment.completed to not be a batch event")
		}
	})

	t.Run("IsX402Event", func(t *testing.T) {
		event := &WebhookEvent{Type: WebhookX402Executed}
		if !IsX402Event(event) {
			t.Error("expected x402.executed to be an x402 event")
		}

		event = &WebhookEvent{Type: WebhookPaymentCompleted}
		if IsX402Event(event) {
			t.Error("expected payment.completed to not be an x402 event")
		}
	})

	t.Run("IsSuccessEvent", func(t *testing.T) {
		event := &WebhookEvent{Type: WebhookPaymentCompleted}
		if !IsSuccessEvent(event) {
			t.Error("expected payment.completed to be a success event")
		}

		event = &WebhookEvent{Type: WebhookX402Executed}
		if !IsSuccessEvent(event) {
			t.Error("expected x402.executed to be a success event")
		}

		event = &WebhookEvent{Type: WebhookPaymentFailed}
		if IsSuccessEvent(event) {
			t.Error("expected payment.failed to not be a success event")
		}
	})

	t.Run("IsFailureEvent", func(t *testing.T) {
		event := &WebhookEvent{Type: WebhookPaymentFailed}
		if !IsFailureEvent(event) {
			t.Error("expected payment.failed to be a failure event")
		}

		event = &WebhookEvent{Type: WebhookPaymentExpired}
		if !IsFailureEvent(event) {
			t.Error("expected payment.expired to be a failure event")
		}

		event = &WebhookEvent{Type: WebhookPaymentCompleted}
		if IsFailureEvent(event) {
			t.Error("expected payment.completed to not be a failure event")
		}
	})
}

func TestParseEventData(t *testing.T) {
	t.Run("ParsePaymentEvent", func(t *testing.T) {
		data := map[string]interface{}{
			"paymentId":        "pay_123",
			"amount":           "100",
			"token":            "USDC",
			"chain":            "ethereum",
			"recipientAddress": "0x1234...",
		}

		event := &WebhookEvent{
			Type: WebhookPaymentCompleted,
			Data: data,
		}

		paymentData, err := ParsePaymentEvent(event)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if paymentData.PaymentID != "pay_123" {
			t.Errorf("expected PaymentID to be pay_123, got %s", paymentData.PaymentID)
		}
	})

	t.Run("ParseBatchEvent", func(t *testing.T) {
		data := map[string]interface{}{
			"batchId":         "batch_123",
			"totalRecipients": float64(10),
			"completedCount":  float64(8),
			"failedCount":     float64(2),
		}

		event := &WebhookEvent{
			Type: WebhookBatchCompleted,
			Data: data,
		}

		batchData, err := ParseBatchEvent(event)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if batchData.BatchID != "batch_123" {
			t.Errorf("expected BatchID to be batch_123, got %s", batchData.BatchID)
		}
	})

	t.Run("ParseX402Event", func(t *testing.T) {
		data := map[string]interface{}{
			"authorizationId": "x402_123",
			"amount":          "100",
			"token":           "USDC",
			"chainId":         float64(1),
		}

		event := &WebhookEvent{
			Type: WebhookX402Executed,
			Data: data,
		}

		x402Data, err := ParseX402Event(event)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if x402Data.AuthorizationID != "x402_123" {
			t.Errorf("expected AuthorizationID to be x402_123, got %s", x402Data.AuthorizationID)
		}
	})
}

func TestIsValidEventType(t *testing.T) {
	module := NewWebhookModule()

	validTypes := []string{
		"payment.created",
		"payment.completed",
		"payment.failed",
		"payment.expired",
		"batch.created",
		"batch.processing",
		"batch.completed",
		"batch.failed",
		"x402.created",
		"x402.signed",
		"x402.executed",
		"x402.failed",
		"x402.expired",
	}

	for _, eventType := range validTypes {
		if !module.IsValidEventType(eventType) {
			t.Errorf("expected %s to be valid", eventType)
		}
	}

	invalidTypes := []string{
		"unknown.event",
		"payment",
		"",
		"payment.unknown",
	}

	for _, eventType := range invalidTypes {
		if module.IsValidEventType(eventType) {
			t.Errorf("expected %s to be invalid", eventType)
		}
	}
}

// Helper function
func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstringHelper(s, substr))
}

func containsSubstringHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Helper to create JSON payload
func createPayload(data interface{}) string {
	b, _ := json.Marshal(data)
	return string(b)
}
