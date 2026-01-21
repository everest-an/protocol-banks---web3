package protocolbanks

import (
	"testing"
)

func TestIsValidEthereumAddress(t *testing.T) {
	validAddresses := []string{
		"0x1234567890123456789012345678901234567890",
		"0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
		"0xabcdef1234567890abcdef1234567890abcdef12",
	}

	for _, addr := range validAddresses {
		if !IsValidEthereumAddress(addr) {
			t.Errorf("expected %s to be valid", addr)
		}
	}

	invalidAddresses := []string{
		"",
		"0x",
		"0x123",
		"1234567890123456789012345678901234567890",
		"0x12345678901234567890123456789012345678901", // 41 chars
		"0x123456789012345678901234567890123456789",   // 39 chars
		"0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // invalid hex
	}

	for _, addr := range invalidAddresses {
		if IsValidEthereumAddress(addr) {
			t.Errorf("expected %s to be invalid", addr)
		}
	}
}

func TestIsValidSolanaAddress(t *testing.T) {
	validAddresses := []string{
		"11111111111111111111111111111111",
		"So11111111111111111111111111111111111111112",
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	}

	for _, addr := range validAddresses {
		if !IsValidSolanaAddress(addr) {
			t.Errorf("expected %s to be valid Solana address", addr)
		}
	}

	invalidAddresses := []string{
		"",
		"0x1234567890123456789012345678901234567890", // Ethereum address
		"short",
		"contains0OIl", // Contains invalid Base58 characters
	}

	for _, addr := range invalidAddresses {
		if IsValidSolanaAddress(addr) {
			t.Errorf("expected %s to be invalid Solana address", addr)
		}
	}
}

func TestIsValidBitcoinAddress(t *testing.T) {
	validAddresses := []string{
		"1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
		"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
		"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
	}

	for _, addr := range validAddresses {
		if !IsValidBitcoinAddress(addr) {
			t.Errorf("expected %s to be valid Bitcoin address", addr)
		}
	}

	invalidAddresses := []string{
		"",
		"0x1234567890123456789012345678901234567890", // Ethereum address
		"invalid",
	}

	for _, addr := range invalidAddresses {
		if IsValidBitcoinAddress(addr) {
			t.Errorf("expected %s to be invalid Bitcoin address", addr)
		}
	}
}

func TestDetectHomoglyphs(t *testing.T) {
	t.Run("detects Cyrillic homoglyphs", func(t *testing.T) {
		// Address with Cyrillic 'а' (U+0430) instead of Latin 'a'
		address := "0x1234567890123456789012345678901234567890"
		addressWithHomoglyph := "0x1234567890123456789012345678901234567890"

		// Replace 'a' with Cyrillic 'а'
		addressWithHomoglyph = "0x123456789012345678901234567890123456789а"

		result := DetectHomoglyphs(addressWithHomoglyph)

		if result == nil {
			t.Error("expected homoglyph to be detected")
		}

		if len(result.DetectedCharacters) == 0 {
			t.Error("expected detected characters to be set")
		}

		// Clean address should not have homoglyphs
		result = DetectHomoglyphs(address)
		if result != nil {
			t.Error("expected no homoglyphs in clean address")
		}
	})

	t.Run("returns nil for clean address", func(t *testing.T) {
		address := "0x1234567890123456789012345678901234567890"
		result := DetectHomoglyphs(address)

		if result != nil {
			t.Error("expected nil for clean address")
		}
	})
}

func TestIsValidAmount(t *testing.T) {
	validAmounts := []string{
		"1",
		"100",
		"100.50",
		"0.001",
		"999999999",
	}

	for _, amount := range validAmounts {
		if !IsValidAmount(amount) {
			t.Errorf("expected %s to be valid", amount)
		}
	}

	invalidAmounts := []string{
		"",
		"0",
		"-100",
		"abc",
		"2000000000", // 2 billion, exceeds max
	}

	for _, amount := range invalidAmounts {
		if IsValidAmount(amount) {
			t.Errorf("expected %s to be invalid", amount)
		}
	}
}

func TestValidateAmount(t *testing.T) {
	t.Run("accepts valid amount", func(t *testing.T) {
		err := ValidateAmount("100")
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("rejects empty amount", func(t *testing.T) {
		err := ValidateAmount("")
		if err == nil {
			t.Error("expected error for empty amount")
		}
	})

	t.Run("rejects negative amount", func(t *testing.T) {
		err := ValidateAmount("-100")
		if err == nil {
			t.Error("expected error for negative amount")
		}
	})

	t.Run("rejects amount exceeding max", func(t *testing.T) {
		err := ValidateAmount("2000000000")
		if err == nil {
			t.Error("expected error for amount exceeding max")
		}
	})
}

func TestIsValidToken(t *testing.T) {
	validTokens := []TokenSymbol{
		TokenUSDC,
		TokenUSDT,
		TokenDAI,
		TokenETH,
		TokenMATIC,
		TokenBNB,
		TokenSOL,
		TokenBTC,
	}

	for _, token := range validTokens {
		if !IsValidToken(token) {
			t.Errorf("expected %s to be valid", token)
		}
	}

	invalidTokens := []TokenSymbol{
		"",
		"INVALID",
		"usdc", // lowercase
	}

	for _, token := range invalidTokens {
		if IsValidToken(token) {
			t.Errorf("expected %s to be invalid", token)
		}
	}
}

func TestIsValidExpiryHours(t *testing.T) {
	validHours := []int{1, 24, 48, 168}

	for _, hours := range validHours {
		if !IsValidExpiryHours(hours) {
			t.Errorf("expected %d to be valid", hours)
		}
	}

	invalidHours := []int{0, -1, 169, 1000}

	for _, hours := range invalidHours {
		if IsValidExpiryHours(hours) {
			t.Errorf("expected %d to be invalid", hours)
		}
	}
}

func TestIsValidMemo(t *testing.T) {
	t.Run("accepts valid memo", func(t *testing.T) {
		if !IsValidMemo("This is a valid memo") {
			t.Error("expected valid memo to be accepted")
		}
	})

	t.Run("accepts empty memo", func(t *testing.T) {
		if !IsValidMemo("") {
			t.Error("expected empty memo to be accepted")
		}
	})

	t.Run("rejects memo exceeding max length", func(t *testing.T) {
		longMemo := make([]byte, 257)
		for i := range longMemo {
			longMemo[i] = 'a'
		}

		if IsValidMemo(string(longMemo)) {
			t.Error("expected long memo to be rejected")
		}
	})
}

func TestValidateBatchSize(t *testing.T) {
	t.Run("accepts valid batch size", func(t *testing.T) {
		err := ValidateBatchSize(100)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("accepts max batch size", func(t *testing.T) {
		err := ValidateBatchSize(500)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("rejects empty batch", func(t *testing.T) {
		err := ValidateBatchSize(0)
		if err == nil {
			t.Error("expected error for empty batch")
		}
	})

	t.Run("rejects batch exceeding max", func(t *testing.T) {
		err := ValidateBatchSize(501)
		if err == nil {
			t.Error("expected error for batch exceeding max")
		}
	})
}

func TestNormalizeAddress(t *testing.T) {
	address := "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
	normalized := NormalizeAddress(address)

	expected := "0xabcdef1234567890abcdef1234567890abcdef12"
	if normalized != expected {
		t.Errorf("expected %s, got %s", expected, normalized)
	}
}
