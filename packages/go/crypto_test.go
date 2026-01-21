package protocolbanks

import (
	"strings"
	"testing"
)

func TestGenerateUUID(t *testing.T) {
	uuid1 := GenerateUUID()
	uuid2 := GenerateUUID()

	if uuid1 == "" {
		t.Error("expected UUID to be generated")
	}

	if uuid1 == uuid2 {
		t.Error("expected UUIDs to be unique")
	}

	// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	if len(uuid1) != 36 {
		t.Errorf("expected UUID length to be 36, got %d", len(uuid1))
	}
}

func TestGeneratePaymentID(t *testing.T) {
	id := GeneratePaymentID()

	if !strings.HasPrefix(id, "pay_") {
		t.Errorf("expected payment ID to start with 'pay_', got %s", id)
	}

	// Should be unique
	id2 := GeneratePaymentID()
	if id == id2 {
		t.Error("expected payment IDs to be unique")
	}
}

func TestGenerateBatchID(t *testing.T) {
	id := GenerateBatchID()

	if !strings.HasPrefix(id, "batch_") {
		t.Errorf("expected batch ID to start with 'batch_', got %s", id)
	}
}

func TestGenerateX402ID(t *testing.T) {
	id := GenerateX402ID()

	if !strings.HasPrefix(id, "x402_") {
		t.Errorf("expected x402 ID to start with 'x402_', got %s", id)
	}
}

func TestGenerateNonce(t *testing.T) {
	nonce1 := GenerateNonce()
	nonce2 := GenerateNonce()

	if nonce1 == "" {
		t.Error("expected nonce to be generated")
	}

	if !strings.HasPrefix(nonce1, "0x") {
		t.Errorf("expected nonce to start with '0x', got %s", nonce1)
	}

	// Should be 32 bytes = 64 hex chars + 0x prefix
	if len(nonce1) != 66 {
		t.Errorf("expected nonce length to be 66, got %d", len(nonce1))
	}

	if nonce1 == nonce2 {
		t.Error("expected nonces to be unique")
	}
}

func TestHMACSign(t *testing.T) {
	data := "test data"
	secret := "test secret"

	sig1 := HMACSign(data, secret)
	sig2 := HMACSign(data, secret)

	if sig1 == "" {
		t.Error("expected signature to be generated")
	}

	// Same data and secret should produce same signature
	if sig1 != sig2 {
		t.Error("expected same signature for same input")
	}

	// Different data should produce different signature
	sig3 := HMACSign("different data", secret)
	if sig1 == sig3 {
		t.Error("expected different signature for different data")
	}

	// Different secret should produce different signature
	sig4 := HMACSign(data, "different secret")
	if sig1 == sig4 {
		t.Error("expected different signature for different secret")
	}
}

func TestHMACVerify(t *testing.T) {
	data := "test data"
	secret := "test secret"

	sig := HMACSign(data, secret)

	if !HMACVerify(data, sig, secret) {
		t.Error("expected verification to succeed")
	}

	if HMACVerify(data, "wrong signature", secret) {
		t.Error("expected verification to fail with wrong signature")
	}

	if HMACVerify("wrong data", sig, secret) {
		t.Error("expected verification to fail with wrong data")
	}

	if HMACVerify(data, sig, "wrong secret") {
		t.Error("expected verification to fail with wrong secret")
	}
}

func TestConstantTimeEqual(t *testing.T) {
	if !ConstantTimeEqual("test", "test") {
		t.Error("expected equal strings to match")
	}

	if ConstantTimeEqual("test", "different") {
		t.Error("expected different strings to not match")
	}

	if ConstantTimeEqual("test", "test1") {
		t.Error("expected different length strings to not match")
	}

	if ConstantTimeEqual("", "test") {
		t.Error("expected empty string to not match non-empty")
	}

	if !ConstantTimeEqual("", "") {
		t.Error("expected empty strings to match")
	}
}

func TestGeneratePaymentLinkSignature(t *testing.T) {
	params := PaymentLinkSignatureParams{
		To:     "0x1234567890123456789012345678901234567890",
		Amount: "100",
		Token:  "USDC",
		Expiry: 1234567890000,
		Memo:   "test memo",
	}
	secret := "test-secret"

	sig1 := GeneratePaymentLinkSignature(params, secret)
	sig2 := GeneratePaymentLinkSignature(params, secret)

	if sig1 == "" {
		t.Error("expected signature to be generated")
	}

	// Should be 16 characters
	if len(sig1) != 16 {
		t.Errorf("expected signature length to be 16, got %d", len(sig1))
	}

	// Same params should produce same signature
	if sig1 != sig2 {
		t.Error("expected same signature for same params")
	}

	// Different params should produce different signature
	params2 := params
	params2.Amount = "200"
	sig3 := GeneratePaymentLinkSignature(params2, secret)
	if sig1 == sig3 {
		t.Error("expected different signature for different params")
	}
}

func TestVerifyPaymentLinkSignature(t *testing.T) {
	params := PaymentLinkSignatureParams{
		To:     "0x1234567890123456789012345678901234567890",
		Amount: "100",
		Token:  "USDC",
		Expiry: 1234567890000,
		Memo:   "test memo",
	}
	secret := "test-secret"

	sig := GeneratePaymentLinkSignature(params, secret)

	if !VerifyPaymentLinkSignature(params, sig, secret) {
		t.Error("expected verification to succeed")
	}

	if VerifyPaymentLinkSignature(params, "wrong-signature", secret) {
		t.Error("expected verification to fail with wrong signature")
	}

	params2 := params
	params2.Amount = "200"
	if VerifyPaymentLinkSignature(params2, sig, secret) {
		t.Error("expected verification to fail with different params")
	}
}

func TestWebhookSignature(t *testing.T) {
	payload := `{"id":"evt_123","type":"payment.completed"}`
	secret := "whsec_test"
	timestamp := int64(1234567890)

	sig := GenerateWebhookSignature(payload, secret, timestamp)

	if sig == "" {
		t.Error("expected signature to be generated")
	}

	if !VerifyWebhookSignature(payload, sig, secret, timestamp) {
		t.Error("expected verification to succeed")
	}

	if VerifyWebhookSignature(payload, "wrong", secret, timestamp) {
		t.Error("expected verification to fail with wrong signature")
	}

	if VerifyWebhookSignature("wrong payload", sig, secret, timestamp) {
		t.Error("expected verification to fail with wrong payload")
	}

	if VerifyWebhookSignature(payload, sig, "wrong secret", timestamp) {
		t.Error("expected verification to fail with wrong secret")
	}

	if VerifyWebhookSignature(payload, sig, secret, timestamp+1) {
		t.Error("expected verification to fail with wrong timestamp")
	}
}

func TestFormatWebhookSignature(t *testing.T) {
	sig := "abc123"
	timestamp := int64(1234567890)

	formatted := FormatWebhookSignature(sig, timestamp)

	expected := "t=1234567890,v1=abc123"
	if formatted != expected {
		t.Errorf("expected %s, got %s", expected, formatted)
	}
}

func TestParseWebhookSignature(t *testing.T) {
	t.Run("parses valid signature", func(t *testing.T) {
		header := "t=1234567890,v1=abc123"

		timestamp, sig, ok := ParseWebhookSignature(header)

		if !ok {
			t.Error("expected parsing to succeed")
		}

		if timestamp != 1234567890 {
			t.Errorf("expected timestamp 1234567890, got %d", timestamp)
		}

		if sig != "abc123" {
			t.Errorf("expected signature abc123, got %s", sig)
		}
	})

	t.Run("fails on invalid format", func(t *testing.T) {
		invalidHeaders := []string{
			"",
			"invalid",
			"t=abc,v1=123",  // non-numeric timestamp
			"t=123",         // missing signature
			"v1=123",        // missing timestamp
		}

		for _, header := range invalidHeaders {
			_, _, ok := ParseWebhookSignature(header)
			if ok {
				t.Errorf("expected parsing to fail for %s", header)
			}
		}
	})
}
