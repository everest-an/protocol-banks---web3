package watcher

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTransferEvent(t *testing.T) {
	tests := []struct {
		name     string
		topics   []string
		data     string
		expected *TransferEvent
		hasError bool
	}{
		{
			name: "valid ERC20 transfer",
			topics: []string{
				"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer topic
				"0x0000000000000000000000001111111111111111111111111111111111111111", // from
				"0x0000000000000000000000002222222222222222222222222222222222222222", // to
			},
			data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000", // 1 ETH
			expected: &TransferEvent{
				From:   "0x1111111111111111111111111111111111111111",
				To:     "0x2222222222222222222222222222222222222222",
				Amount: big.NewInt(1000000000000000000),
			},
			hasError: false,
		},
		{
			name:     "missing topics",
			topics:   []string{},
			data:     "0x",
			expected: nil,
			hasError: true,
		},
		{
			name: "invalid topic count",
			topics: []string{
				"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
			},
			data:     "0x",
			expected: nil,
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event, err := parseTransferEvent(tt.topics, tt.data)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected.From, event.From)
				assert.Equal(t, tt.expected.To, event.To)
				assert.Equal(t, tt.expected.Amount.String(), event.Amount.String())
			}
		})
	}
}

func TestBlockRangeCalculation(t *testing.T) {
	tests := []struct {
		name         string
		fromBlock    uint64
		toBlock      uint64
		maxRange     uint64
		expectedRanges []BlockRange
	}{
		{
			name:      "single range",
			fromBlock: 100,
			toBlock:   150,
			maxRange:  100,
			expectedRanges: []BlockRange{{From: 100, To: 150}},
		},
		{
			name:      "multiple ranges",
			fromBlock: 100,
			toBlock:   350,
			maxRange:  100,
			expectedRanges: []BlockRange{
				{From: 100, To: 199},
				{From: 200, To: 299},
				{From: 300, To: 350},
			},
		},
		{
			name:      "exact boundary",
			fromBlock: 100,
			toBlock:   299,
			maxRange:  100,
			expectedRanges: []BlockRange{
				{From: 100, To: 199},
				{From: 200, To: 299},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ranges := calculateBlockRanges(tt.fromBlock, tt.toBlock, tt.maxRange)
			assert.Equal(t, len(tt.expectedRanges), len(ranges))
			for i, r := range ranges {
				assert.Equal(t, tt.expectedRanges[i].From, r.From)
				assert.Equal(t, tt.expectedRanges[i].To, r.To)
			}
		})
	}
}

func TestChainConfig(t *testing.T) {
	tests := []struct {
		chainID       int64
		expectedName  string
		expectedDelay time.Duration
	}{
		{1, "Ethereum Mainnet", 12 * time.Second},
		{137, "Polygon", 2 * time.Second},
		{42161, "Arbitrum One", 250 * time.Millisecond},
		{8453, "Base", 2 * time.Second},
		{10, "Optimism", 2 * time.Second},
		{56, "BNB Chain", 3 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.expectedName, func(t *testing.T) {
			config := getChainConfig(tt.chainID)
			assert.Equal(t, tt.expectedName, config.Name)
			assert.Equal(t, tt.expectedDelay, config.BlockTime)
		})
	}
}

func TestReorgDetection(t *testing.T) {
	tests := []struct {
		name           string
		previousHash   string
		currentParent  string
		expectReorg    bool
	}{
		{
			name:          "no reorg",
			previousHash:  "0xabc123",
			currentParent: "0xabc123",
			expectReorg:   false,
		},
		{
			name:          "reorg detected",
			previousHash:  "0xabc123",
			currentParent: "0xdef456",
			expectReorg:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detectReorg(tt.previousHash, tt.currentParent)
			assert.Equal(t, tt.expectReorg, result)
		})
	}
}

// Helper types and functions for tests
type TransferEvent struct {
	From   string
	To     string
	Amount *big.Int
}

type BlockRange struct {
	From uint64
	To   uint64
}

type ChainConfig struct {
	Name      string
	BlockTime time.Duration
}

func parseTransferEvent(topics []string, data string) (*TransferEvent, error) {
	if len(topics) < 3 {
		return nil, assert.AnError
	}

	from := "0x" + topics[1][26:]
	to := "0x" + topics[2][26:]

	amount := new(big.Int)
	amount.SetString(data[2:], 16)

	return &TransferEvent{
		From:   from,
		To:     to,
		Amount: amount,
	}, nil
}

func calculateBlockRanges(from, to, maxRange uint64) []BlockRange {
	var ranges []BlockRange
	for start := from; start <= to; start += maxRange {
		end := start + maxRange - 1
		if end > to {
			end = to
		}
		ranges = append(ranges, BlockRange{From: start, To: end})
	}
	return ranges
}

func getChainConfig(chainID int64) ChainConfig {
	configs := map[int64]ChainConfig{
		1:     {Name: "Ethereum Mainnet", BlockTime: 12 * time.Second},
		137:   {Name: "Polygon", BlockTime: 2 * time.Second},
		42161: {Name: "Arbitrum One", BlockTime: 250 * time.Millisecond},
		8453:  {Name: "Base", BlockTime: 2 * time.Second},
		10:   {Name: "Optimism", BlockTime: 2 * time.Second},
		56:    {Name: "BNB Chain", BlockTime: 3 * time.Second},
	}
	return configs[chainID]
}

func detectReorg(previousHash, currentParent string) bool {
	return previousHash != currentParent
}
