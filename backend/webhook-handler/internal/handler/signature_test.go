package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestVerifyHMACSignature(t *testing.T) {
	secret := "test-secret-key"
	payload := `{"event":"transaction.completed","data":{"id":"123"}}`

	// Generate valid signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	validSignature := hex.EncodeToString(mac.Sum(nil))

	tests := []struct {
		name      string
		payload   string
		signature string
		secret    string
		valid     bool
	}{
		{"valid signature", payload, validSignature, secret, true},
		{"invalid signature", payload, "invalid-signature", secret, false},
		{"wrong secret", payload, validSignature, "wrong-secret", false},
		{"empty signature", payload, "", secret, false},
		{"empty payload", "", validSignature, secret, false},
		{"tampered payload", payload + "x", validSignature, secret, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := verifyHMACSignature(tt.payload, tt.signature, tt.secret)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestVerifyTimestamp(t *testing.T) {
	now := time.Now()
	
	tests := []struct {
		name      string
		timestamp int64
		maxAge    time.Duration
		valid     bool
	}{
		{"current timestamp", now.Unix(), 5 * time.Minute, true},
		{"1 minute ago", now.Add(-1 * time.Minute).Unix(), 5 * time.Minute, true},
		{"4 minutes ago", now.Add(-4 * time.Minute).Unix(), 5 * time.Minute, true},
		{"6 minutes ago (expired)", now.Add(-6 * time.Minute).Unix(), 5 * time.Minute, false},
		{"future timestamp", now.Add(1 * time.Minute).Unix(), 5 * time.Minute, true},
		{"far future (suspicious)", now.Add(10 * time.Minute).Unix(), 5 * time.Minute, false},
		{"zero timestamp", 0, 5 * time.Minute, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := verifyTimestamp(tt.timestamp, tt.maxAge)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestIdempotencyKeyGeneration(t *testing.T) {
	tests := []struct {
		name     string
		eventID  string
		source   string
		expected string
	}{
		{"rain event", "evt_123", "rain", "rain:evt_123"},
		{"transak event", "txn_456", "transak", "transak:txn_456"},
		{"empty event ID", "", "rain", "rain:"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := generateIdempotencyKey(tt.source, tt.eventID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseRainEvent(t *testing.T) {
	validPayload := `{
		"event": "card.transaction.completed",
		"data": {
			"id": "txn_12345",
			"amount": "100.00",
			"currency": "USD",
			"card_id": "card_abc",
			"merchant": "Amazon",
			"status": "completed"
		},
		"timestamp": 1704067200
	}`

	invalidPayload := `{invalid json}`

	t.Run("valid payload", func(t *testing.T) {
		event, err := parseRainEvent([]byte(validPayload))
		assert.NoError(t, err)
		assert.Equal(t, "card.transaction.completed", event.Event)
		assert.Equal(t, "txn_12345", event.Data.ID)
		assert.Equal(t, "100.00", event.Data.Amount)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		_, err := parseRainEvent([]byte(invalidPayload))
		assert.Error(t, err)
	})
}

// Helper functions
func verifyHMACSignature(payload, signature, secret string) bool {
	if payload == "" || signature == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSig))
}

func verifyTimestamp(timestamp int64, maxAge time.Duration) bool {
	if timestamp == 0 {
		return false
	}

	eventTime := time.Unix(timestamp, 0)
	now := time.Now()

	// Check if timestamp is too old
	if now.Sub(eventTime) > maxAge {
		return false
	}

	// Check if timestamp is too far in the future (suspicious)
	if eventTime.Sub(now) > maxAge {
		return false
	}

	return true
}

func generateIdempotencyKey(source, eventID string) string {
	return source + ":" + eventID
}

type RainEvent struct {
	Event     string    `json:"event"`
	Data      RainData  `json:"data"`
	Timestamp int64     `json:"timestamp"`
}

type RainData struct {
	ID       string `json:"id"`
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
	CardID   string `json:"card_id"`
	Merchant string `json:"merchant"`
	Status   string `json:"status"`
}

func parseRainEvent(payload []byte) (*RainEvent, error) {
	var event RainEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		return nil, err
	}
	return &event, nil
}

import "encoding/json"
