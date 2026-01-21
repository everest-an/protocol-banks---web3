package protocolbanks

import (
	"testing"
)

func TestBatchValidate(t *testing.T) {
	module := NewBatchModule(nil)

	t.Run("validates valid recipients", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "0x1234567890123456789012345678901234567890", Amount: "100", Token: TokenUSDC},
			{Address: "0xabcdef1234567890abcdef1234567890abcdef12", Amount: "200", Token: TokenUSDT},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Filter out duplicate warnings
		var criticalErrors []BatchValidationError
		for _, e := range errors {
			hasCritical := false
			for _, errMsg := range e.Errors {
				if !containsSubstring(errMsg, "Duplicate") {
					hasCritical = true
					break
				}
			}
			if hasCritical {
				criticalErrors = append(criticalErrors, e)
			}
		}

		if len(criticalErrors) > 0 {
			t.Errorf("expected no critical errors, got %v", criticalErrors)
		}
	})

	t.Run("detects invalid addresses", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "invalid-address", Amount: "100", Token: TokenUSDC},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(errors) == 0 {
			t.Error("expected validation errors for invalid address")
		}

		found := false
		for _, e := range errors {
			for _, errMsg := range e.Errors {
				if containsSubstring(errMsg, "Invalid address") {
					found = true
					break
				}
			}
		}

		if !found {
			t.Error("expected 'Invalid address' error")
		}
	})

	t.Run("detects invalid amounts", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "0x1234567890123456789012345678901234567890", Amount: "-100", Token: TokenUSDC},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(errors) == 0 {
			t.Error("expected validation errors for invalid amount")
		}
	})

	t.Run("detects invalid tokens", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "0x1234567890123456789012345678901234567890", Amount: "100", Token: "INVALID"},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(errors) == 0 {
			t.Error("expected validation errors for invalid token")
		}
	})

	t.Run("detects missing required fields", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "", Amount: "", Token: ""},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(errors) == 0 {
			t.Error("expected validation errors for missing fields")
		}

		// Should have errors for address, amount, and token
		if len(errors[0].Errors) < 3 {
			t.Errorf("expected at least 3 errors, got %d", len(errors[0].Errors))
		}
	})

	t.Run("detects duplicate addresses", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "0x1234567890123456789012345678901234567890", Amount: "100", Token: TokenUSDC},
			{Address: "0x1234567890123456789012345678901234567890", Amount: "200", Token: TokenUSDC},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should have duplicate warnings
		hasDuplicateWarning := false
		for _, e := range errors {
			for _, errMsg := range e.Errors {
				if containsSubstring(errMsg, "Duplicate") {
					hasDuplicateWarning = true
					break
				}
			}
		}

		if !hasDuplicateWarning {
			t.Error("expected duplicate address warning")
		}
	})

	t.Run("validates all recipients not just first", func(t *testing.T) {
		recipients := []BatchRecipient{
			{Address: "0x1234567890123456789012345678901234567890", Amount: "100", Token: TokenUSDC},
			{Address: "invalid-address-1", Amount: "100", Token: TokenUSDC},
			{Address: "0xabcdef1234567890abcdef1234567890abcdef12", Amount: "100", Token: TokenUSDC},
			{Address: "invalid-address-2", Amount: "100", Token: TokenUSDC},
		}

		errors, err := module.Validate(recipients)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should have errors for both invalid addresses (indices 1 and 3)
		invalidIndices := make(map[int]bool)
		for _, e := range errors {
			for _, errMsg := range e.Errors {
				if containsSubstring(errMsg, "Invalid address") {
					invalidIndices[e.Index] = true
				}
			}
		}

		if !invalidIndices[1] || !invalidIndices[3] {
			t.Error("expected errors for all invalid addresses, not just first")
		}
	})

	t.Run("rejects empty batch", func(t *testing.T) {
		_, err := module.Validate([]BatchRecipient{})
		if err == nil {
			t.Error("expected error for empty batch")
		}
	})

	t.Run("rejects batch exceeding max size", func(t *testing.T) {
		recipients := make([]BatchRecipient, 501)
		for i := range recipients {
			recipients[i] = BatchRecipient{
				Address: "0x1234567890123456789012345678901234567890",
				Amount:  "100",
				Token:   TokenUSDC,
			}
		}

		_, err := module.Validate(recipients)
		if err == nil {
			t.Error("expected error for batch exceeding max size")
		}

		sdkErr, ok := err.(*SDKError)
		if !ok {
			t.Error("expected SDKError")
		}

		if sdkErr.Code != ErrBatchSizeExceeded {
			t.Errorf("expected error code %s, got %s", ErrBatchSizeExceeded, sdkErr.Code)
		}
	})
}

func TestBatchCalculateTotal(t *testing.T) {
	module := NewBatchModule(nil)

	recipients := []BatchRecipient{
		{Address: "0x1234567890123456789012345678901234567890", Amount: "100", Token: TokenUSDC},
		{Address: "0xabcdef1234567890abcdef1234567890abcdef12", Amount: "200", Token: TokenUSDC},
		{Address: "0x1111111111111111111111111111111111111111", Amount: "50", Token: TokenUSDT},
		{Address: "0x2222222222222222222222222222222222222222", Amount: "1", Token: TokenETH},
	}

	byToken, totalUSD := module.CalculateTotal(recipients)

	// Check USDC total
	if byToken[TokenUSDC] != "300.000000" {
		t.Errorf("expected USDC total 300.000000, got %s", byToken[TokenUSDC])
	}

	// Check USDT total
	if byToken[TokenUSDT] != "50.000000" {
		t.Errorf("expected USDT total 50.000000, got %s", byToken[TokenUSDT])
	}

	// Check ETH total
	if byToken[TokenETH] != "1.000000" {
		t.Errorf("expected ETH total 1.000000, got %s", byToken[TokenETH])
	}

	// Check USD total (only stablecoins)
	if totalUSD != "350.00" {
		t.Errorf("expected USD total 350.00, got %s", totalUSD)
	}
}

func TestBatchGetProgress(t *testing.T) {
	module := NewBatchModule(nil)

	t.Run("calculates progress correctly", func(t *testing.T) {
		status := &BatchStatus{
			Progress: BatchProgress{
				Total:     100,
				Completed: 50,
				Failed:    10,
				Pending:   40,
			},
		}

		progress := module.GetProgress(status)

		// (50 + 10) / 100 * 100 = 60%
		if progress != 60 {
			t.Errorf("expected progress 60, got %d", progress)
		}
	})

	t.Run("handles zero total", func(t *testing.T) {
		status := &BatchStatus{
			Progress: BatchProgress{
				Total:     0,
				Completed: 0,
				Failed:    0,
				Pending:   0,
			},
		}

		progress := module.GetProgress(status)

		if progress != 0 {
			t.Errorf("expected progress 0 for zero total, got %d", progress)
		}
	})

	t.Run("handles 100% completion", func(t *testing.T) {
		status := &BatchStatus{
			Progress: BatchProgress{
				Total:     100,
				Completed: 100,
				Failed:    0,
				Pending:   0,
			},
		}

		progress := module.GetProgress(status)

		if progress != 100 {
			t.Errorf("expected progress 100, got %d", progress)
		}
	})
}
