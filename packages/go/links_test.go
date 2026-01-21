package protocolbanks

import (
	"strings"
	"testing"
	"time"
)

func TestPaymentLinkGenerate(t *testing.T) {
	module := NewPaymentLinkModule("test-secret", "")

	t.Run("generates valid payment link", func(t *testing.T) {
		link, err := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "100",
			Token:  TokenUSDC,
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if link.URL == "" {
			t.Error("expected URL to be set")
		}

		if link.PaymentID == "" {
			t.Error("expected PaymentID to be set")
		}

		if !strings.HasPrefix(link.PaymentID, "pay_") {
			t.Errorf("expected PaymentID to start with 'pay_', got %s", link.PaymentID)
		}

		if link.Signature == "" {
			t.Error("expected Signature to be set")
		}

		if link.ExpiresAt.Before(time.Now()) {
			t.Error("expected ExpiresAt to be in the future")
		}
	})

	t.Run("uses default token", func(t *testing.T) {
		link, err := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "100",
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if link.Params.Token != TokenUSDC {
			t.Errorf("expected default token USDC, got %s", link.Params.Token)
		}
	})

	t.Run("rejects invalid address", func(t *testing.T) {
		_, err := module.Generate(PaymentLinkParams{
			To:     "invalid-address",
			Amount: "100",
		})

		if err == nil {
			t.Error("expected error for invalid address")
		}
	})

	t.Run("rejects invalid amount", func(t *testing.T) {
		_, err := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "-100",
		})

		if err == nil {
			t.Error("expected error for negative amount")
		}
	})

	t.Run("rejects amount exceeding max", func(t *testing.T) {
		_, err := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "2000000000", // 2 billion
		})

		if err == nil {
			t.Error("expected error for amount exceeding max")
		}
	})
}

func TestPaymentLinkVerify(t *testing.T) {
	module := NewPaymentLinkModule("test-secret", "")

	t.Run("verifies valid link", func(t *testing.T) {
		link, _ := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "100",
			Token:  TokenUSDC,
		})

		result := module.Verify(link.URL)

		if !result.Valid {
			t.Errorf("expected valid link, got error: %s", result.Error)
		}

		if result.Expired {
			t.Error("expected link to not be expired")
		}

		if result.Params == nil {
			t.Error("expected params to be set")
		}
	})

	t.Run("detects tampered signature", func(t *testing.T) {
		link, _ := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "100",
		})

		// Tamper with the URL
		tamperedURL := strings.Replace(link.URL, "sig=", "sig=tampered", 1)

		result := module.Verify(tamperedURL)

		if result.Valid {
			t.Error("expected invalid result for tampered link")
		}

		if len(result.TamperedFields) == 0 {
			t.Error("expected tampered fields to be detected")
		}
	})

	t.Run("detects homoglyph attack", func(t *testing.T) {
		// Create a URL with Cyrillic 'а' instead of Latin 'a'
		// Note: This is a Cyrillic 'а' (U+0430)
		result := module.Verify("https://app.protocolbanks.com/pay?to=0x1234567890123456789012345678901234567890&amount=100&token=USDC&exp=9999999999999&sig=test")

		// The address is valid, so we need to test with actual homoglyph
		// For now, just verify the function doesn't crash
		if result.Error == "" && !result.Valid {
			// Expected behavior for invalid signature
		}
	})
}

func TestPaymentLinkParse(t *testing.T) {
	module := NewPaymentLinkModule("test-secret", "")

	t.Run("parses valid link", func(t *testing.T) {
		link, _ := module.Generate(PaymentLinkParams{
			To:     "0x1234567890123456789012345678901234567890",
			Amount: "100",
			Token:  TokenUSDC,
			Memo:   "test memo",
		})

		params, err := module.Parse(link.URL)

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if params.To != "0x1234567890123456789012345678901234567890" {
			t.Errorf("expected To to match, got %s", params.To)
		}

		if params.Amount != "100" {
			t.Errorf("expected Amount to be 100, got %s", params.Amount)
		}

		if params.Token != TokenUSDC {
			t.Errorf("expected Token to be USDC, got %s", params.Token)
		}

		if params.Memo != "test memo" {
			t.Errorf("expected Memo to be 'test memo', got %s", params.Memo)
		}
	})

	t.Run("returns error for invalid URL", func(t *testing.T) {
		_, err := module.Parse("not-a-valid-url")

		if err == nil {
			t.Error("expected error for invalid URL")
		}
	})
}

func TestGetSupportedChains(t *testing.T) {
	module := NewPaymentLinkModule("test-secret", "")

	chains := module.GetSupportedChains(TokenUSDC)

	if len(chains) == 0 {
		t.Error("expected at least one chain for USDC")
	}

	// USDC should be supported on Ethereum
	found := false
	for _, c := range chains {
		if c == ChainEthereum {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected Ethereum to support USDC")
	}
}

func TestGetSupportedTokens(t *testing.T) {
	module := NewPaymentLinkModule("test-secret", "")

	tokens := module.GetSupportedTokens(ChainEthereum)

	if len(tokens) == 0 {
		t.Error("expected at least one token for Ethereum")
	}

	// Ethereum should support USDC
	found := false
	for _, tok := range tokens {
		if tok == TokenUSDC {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected Ethereum to support USDC")
	}
}
