package protocolbanks

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
)

// ============================================================================
// UUID Generation
// ============================================================================

// GenerateUUID generates a new UUID v4.
func GenerateUUID() string {
	return uuid.New().String()
}

// GeneratePaymentID generates a new payment ID.
func GeneratePaymentID() string {
	return "pay_" + strings.ReplaceAll(GenerateUUID(), "-", "")
}

// GenerateBatchID generates a new batch ID.
func GenerateBatchID() string {
	return "batch_" + strings.ReplaceAll(GenerateUUID(), "-", "")
}

// GenerateX402ID generates a new x402 authorization ID.
func GenerateX402ID() string {
	return "x402_" + strings.ReplaceAll(GenerateUUID(), "-", "")
}

// ============================================================================
// Nonce Generation
// ============================================================================

// GenerateNonce generates a random 32-byte nonce as hex string.
func GenerateNonce() string {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		// Fallback to UUID-based nonce
		return "0x" + strings.ReplaceAll(GenerateUUID()+GenerateUUID(), "-", "")
	}
	return "0x" + hex.EncodeToString(nonce)
}

// ============================================================================
// HMAC Signature
// ============================================================================

// HMACSign generates an HMAC-SHA256 signature.
func HMACSign(data, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// HMACVerify verifies an HMAC-SHA256 signature using constant-time comparison.
func HMACVerify(data, signature, secret string) bool {
	expected := HMACSign(data, secret)
	return ConstantTimeEqual(signature, expected)
}

// ConstantTimeEqual compares two strings in constant time.
func ConstantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// ============================================================================
// Payment Link Signature
// ============================================================================

// PaymentLinkSignatureParams holds parameters for signature generation.
type PaymentLinkSignatureParams struct {
	To     string
	Amount string
	Token  string
	Expiry int64
	Memo   string
}

// GeneratePaymentLinkSignature generates a signature for a payment link.
func GeneratePaymentLinkSignature(params PaymentLinkSignatureParams, secret string) string {
	// Normalize parameters
	normalized := map[string]string{
		"amount": params.Amount,
		"expiry": fmt.Sprintf("%d", params.Expiry),
		"memo":   params.Memo,
		"to":     strings.ToLower(params.To),
		"token":  strings.ToUpper(params.Token),
	}

	// Create canonical string (sorted keys)
	keys := make([]string, 0, len(normalized))
	for k := range normalized {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", k, normalized[k]))
	}
	dataToSign := strings.Join(parts, "&")

	// Generate HMAC signature and truncate to 16 chars
	fullSig := HMACSign(dataToSign, secret)
	if len(fullSig) > 16 {
		return fullSig[:16]
	}
	return fullSig
}

// VerifyPaymentLinkSignature verifies a payment link signature.
func VerifyPaymentLinkSignature(params PaymentLinkSignatureParams, signature, secret string) bool {
	expected := GeneratePaymentLinkSignature(params, secret)
	return ConstantTimeEqual(signature, expected)
}

// ============================================================================
// Webhook Signature
// ============================================================================

// GenerateWebhookSignature generates a webhook signature.
func GenerateWebhookSignature(payload, secret string, timestamp int64) string {
	dataToSign := fmt.Sprintf("%d.%s", timestamp, payload)
	return HMACSign(dataToSign, secret)
}

// VerifyWebhookSignature verifies a webhook signature.
func VerifyWebhookSignature(payload, signature, secret string, timestamp int64) bool {
	expected := GenerateWebhookSignature(payload, secret, timestamp)
	return ConstantTimeEqual(signature, expected)
}

// FormatWebhookSignature formats a webhook signature header.
func FormatWebhookSignature(signature string, timestamp int64) string {
	return fmt.Sprintf("t=%d,v1=%s", timestamp, signature)
}

// ParseWebhookSignature parses a webhook signature header.
func ParseWebhookSignature(header string) (timestamp int64, signature string, ok bool) {
	parts := strings.Split(header, ",")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			if _, err := fmt.Sscanf(kv[1], "%d", &timestamp); err != nil {
				return 0, "", false
			}
		case "v1":
			signature = kv[1]
		}
	}
	if timestamp == 0 || signature == "" {
		return 0, "", false
	}
	return timestamp, signature, true
}
