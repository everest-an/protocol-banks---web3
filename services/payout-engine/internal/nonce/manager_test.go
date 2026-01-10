package nonce

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRedis(t *testing.T) (*redis.Client, func()) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return client, func() {
		client.Close()
		mr.Close()
	}
}

func TestNonceManager_GetAndIncrement(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address := "0x1234567890123456789012345678901234567890"
	chainID := int64(1)

	// First call should initialize nonce to 0
	nonce1, err := nm.GetAndIncrement(ctx, address, chainID)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), nonce1)

	// Second call should return 1
	nonce2, err := nm.GetAndIncrement(ctx, address, chainID)
	require.NoError(t, err)
	assert.Equal(t, uint64(1), nonce2)

	// Third call should return 2
	nonce3, err := nm.GetAndIncrement(ctx, address, chainID)
	require.NoError(t, err)
	assert.Equal(t, uint64(2), nonce3)
}

func TestNonceManager_SetNonce(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address := "0x1234567890123456789012345678901234567890"
	chainID := int64(1)

	// Set nonce to specific value
	err := nm.SetNonce(ctx, address, chainID, 100)
	require.NoError(t, err)

	// Get should return 100
	nonce, err := nm.GetAndIncrement(ctx, address, chainID)
	require.NoError(t, err)
	assert.Equal(t, uint64(100), nonce)
}

func TestNonceManager_Reset(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address := "0x1234567890123456789012345678901234567890"
	chainID := int64(1)

	// Increment a few times
	nm.GetAndIncrement(ctx, address, chainID)
	nm.GetAndIncrement(ctx, address, chainID)
	nm.GetAndIncrement(ctx, address, chainID)

	// Reset
	err := nm.Reset(ctx, address, chainID)
	require.NoError(t, err)

	// Should start from 0 again
	nonce, err := nm.GetAndIncrement(ctx, address, chainID)
	require.NoError(t, err)
	assert.Equal(t, uint64(0), nonce)
}

func TestNonceManager_ConcurrentAccess(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address := "0x1234567890123456789012345678901234567890"
	chainID := int64(1)

	// Run 100 concurrent goroutines
	numGoroutines := 100
	results := make(chan uint64, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			nonce, err := nm.GetAndIncrement(ctx, address, chainID)
			if err != nil {
				t.Error(err)
				return
			}
			results <- nonce
		}()
	}

	// Collect results
	seen := make(map[uint64]bool)
	for i := 0; i < numGoroutines; i++ {
		select {
		case nonce := <-results:
			// Each nonce should be unique
			assert.False(t, seen[nonce], "Duplicate nonce detected: %d", nonce)
			seen[nonce] = true
		case <-time.After(5 * time.Second):
			t.Fatal("Timeout waiting for goroutines")
		}
	}

	// Should have exactly numGoroutines unique nonces
	assert.Equal(t, numGoroutines, len(seen))
}

func TestNonceManager_MultipleAddresses(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address1 := "0x1111111111111111111111111111111111111111"
	address2 := "0x2222222222222222222222222222222222222222"
	chainID := int64(1)

	// Increment address1
	nonce1a, _ := nm.GetAndIncrement(ctx, address1, chainID)
	nonce1b, _ := nm.GetAndIncrement(ctx, address1, chainID)

	// Increment address2
	nonce2a, _ := nm.GetAndIncrement(ctx, address2, chainID)

	// Address1 should be at 0, 1
	assert.Equal(t, uint64(0), nonce1a)
	assert.Equal(t, uint64(1), nonce1b)

	// Address2 should be at 0 (independent counter)
	assert.Equal(t, uint64(0), nonce2a)
}

func TestNonceManager_MultipleChains(t *testing.T) {
	rdb, cleanup := setupTestRedis(t)
	defer cleanup()

	nm := NewManager(rdb)
	ctx := context.Background()
	address := "0x1234567890123456789012345678901234567890"

	// Increment on Ethereum mainnet
	nonceEth, _ := nm.GetAndIncrement(ctx, address, 1)

	// Increment on Polygon
	noncePoly, _ := nm.GetAndIncrement(ctx, address, 137)

	// Each chain should have independent counters
	assert.Equal(t, uint64(0), nonceEth)
	assert.Equal(t, uint64(0), noncePoly)
}
