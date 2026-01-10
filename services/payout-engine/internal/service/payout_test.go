package service

import (
	"context"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock Ethereum client
type MockEthClient struct {
	mock.Mock
}

func (m *MockEthClient) PendingNonceAt(ctx context.Context, account string) (uint64, error) {
	args := m.Called(ctx, account)
	return args.Get(0).(uint64), args.Error(1)
}

func (m *MockEthClient) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	args := m.Called(ctx)
	return args.Get(0).(*big.Int), args.Error(1)
}

func (m *MockEthClient) EstimateGas(ctx context.Context, msg interface{}) (uint64, error) {
	args := m.Called(ctx, msg)
	return args.Get(0).(uint64), args.Error(1)
}

func TestValidateAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		valid   bool
	}{
		{"valid lowercase", "0x1234567890123456789012345678901234567890", true},
		{"valid uppercase", "0xABCDEF1234567890123456789012345678901234", true},
		{"valid mixed case", "0xAbCdEf1234567890123456789012345678901234", true},
		{"missing 0x prefix", "1234567890123456789012345678901234567890", false},
		{"too short", "0x12345678901234567890123456789012345678", false},
		{"too long", "0x123456789012345678901234567890123456789012", false},
		{"invalid characters", "0xGHIJKL7890123456789012345678901234567890", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidAddress(tt.address)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount string
		valid  bool
	}{
		{"valid integer", "1000000000000000000", true},
		{"valid small", "1", true},
		{"valid large", "999999999999999999999999999999", true},
		{"zero", "0", false},
		{"negative", "-1000", false},
		{"decimal", "1.5", false},
		{"empty", "", false},
		{"non-numeric", "abc", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidAmount(tt.amount)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestCalculateGasBuffer(t *testing.T) {
	tests := []struct {
		name        string
		estimatedGas uint64
		priority    string
		expected    uint64
	}{
		{"low priority 100k gas", 100000, "LOW", 110000},       // 10% buffer
		{"medium priority 100k gas", 100000, "MEDIUM", 120000}, // 20% buffer
		{"high priority 100k gas", 100000, "HIGH", 130000},     // 30% buffer
		{"urgent priority 100k gas", 100000, "URGENT", 150000}, // 50% buffer
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateGasBuffer(tt.estimatedGas, tt.priority)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBatchSizeOptimization(t *testing.T) {
	tests := []struct {
		name          string
		numRecipients int
		maxBatchSize  int
		expectedBatches int
	}{
		{"10 recipients, batch 5", 10, 5, 2},
		{"10 recipients, batch 10", 10, 10, 1},
		{"11 recipients, batch 5", 11, 5, 3},
		{"1 recipient, batch 5", 1, 5, 1},
		{"0 recipients, batch 5", 0, 5, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			batches := calculateBatches(tt.numRecipients, tt.maxBatchSize)
			assert.Equal(t, tt.expectedBatches, batches)
		})
	}
}

// Helper functions for tests
func isValidAddress(address string) bool {
	if len(address) != 42 {
		return false
	}
	if address[:2] != "0x" {
		return false
	}
	for _, c := range address[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func isValidAmount(amount string) bool {
	if amount == "" {
		return false
	}
	val, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return false
	}
	return val.Sign() > 0
}

func calculateGasBuffer(estimatedGas uint64, priority string) uint64 {
	var multiplier float64
	switch priority {
	case "LOW":
		multiplier = 1.1
	case "MEDIUM":
		multiplier = 1.2
	case "HIGH":
		multiplier = 1.3
	case "URGENT":
		multiplier = 1.5
	default:
		multiplier = 1.2
	}
	return uint64(float64(estimatedGas) * multiplier)
}

func calculateBatches(numRecipients, maxBatchSize int) int {
	if numRecipients == 0 {
		return 0
	}
	return (numRecipients + maxBatchSize - 1) / maxBatchSize
}
