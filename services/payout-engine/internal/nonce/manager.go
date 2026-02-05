package nonce

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/go-redis/redis/v8"
	"github.com/protocol-bank/payout-engine/internal/config"
	"github.com/rs/zerolog/log"
)

// Manager 管理多链多地址的 Nonce
type Manager struct {
	redis       *redis.Client
	clients     map[uint64]*ethclient.Client
	localNonces map[string]uint64 // key: chainID:address
	mu          sync.RWMutex
	lockTTL     time.Duration
}

// NewManager 创建 Nonce 管理器
func NewManager(ctx context.Context, cfg config.RedisConfig) (*Manager, error) {
	var rdb *redis.Client
	if strings.HasPrefix(cfg.URL, "redis://") {
		opt, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse redis url: %w", err)
		}
		rdb = redis.NewClient(opt)
	} else {
		rdb = redis.NewClient(&redis.Options{
			Addr:     cfg.URL,
			Password: cfg.Password,
			DB:       cfg.DB,
		})
	}

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	return &Manager{
		redis:       rdb,
		clients:     make(map[uint64]*ethclient.Client),
		localNonces: make(map[string]uint64),
		lockTTL:     30 * time.Second,
	}, nil
}

// AddChainClient 添加链客户端
func (m *Manager) AddChainClient(chainID uint64, client *ethclient.Client) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clients[chainID] = client
}

// GetNonce 获取下一个可用的 Nonce（带分布式锁）
func (m *Manager) GetNonce(ctx context.Context, chainID uint64, address common.Address) (uint64, func(), error) {
	key := fmt.Sprintf("nonce:%d:%s", chainID, address.Hex())
	lockKey := fmt.Sprintf("lock:%s", key)

	// 获取分布式锁
	acquired, err := m.acquireLock(ctx, lockKey)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to acquire lock: %w", err)
	}
	if !acquired {
		return 0, nil, fmt.Errorf("nonce lock busy for %s on chain %d", address.Hex(), chainID)
	}

	releaseFn := func() {
		m.releaseLock(ctx, lockKey)
	}

	// 获取 Nonce
	nonce, err := m.getNonceValue(ctx, chainID, address, key)
	if err != nil {
		releaseFn()
		return 0, nil, err
	}

	// 预增加 Nonce
	m.incrementNonce(ctx, key)

	return nonce, releaseFn, nil
}

// getNonceValue 获取 Nonce 值
func (m *Manager) getNonceValue(ctx context.Context, chainID uint64, address common.Address, key string) (uint64, error) {
	// 先检查 Redis 缓存
	cachedNonce, err := m.redis.Get(ctx, key).Uint64()
	if err == nil {
		return cachedNonce, nil
	}

	// 从链上获取
	m.mu.RLock()
	client, ok := m.clients[chainID]
	m.mu.RUnlock()

	if !ok {
		return 0, fmt.Errorf("no client for chain %d", chainID)
	}

	onchainNonce, err := client.PendingNonceAt(ctx, address)
	if err != nil {
		return 0, fmt.Errorf("failed to get onchain nonce: %w", err)
	}

	// 缓存到 Redis（10 分钟过期）
	m.redis.Set(ctx, key, onchainNonce, 10*time.Minute)

	return onchainNonce, nil
}

// incrementNonce 增加 Nonce
func (m *Manager) incrementNonce(ctx context.Context, key string) {
	m.redis.Incr(ctx, key)
}

// ResetNonce 重置 Nonce（交易失败时使用）
func (m *Manager) ResetNonce(ctx context.Context, chainID uint64, address common.Address) error {
	key := fmt.Sprintf("nonce:%d:%s", chainID, address.Hex())
	return m.redis.Del(ctx, key).Err()
}

// acquireLock 获取分布式锁
func (m *Manager) acquireLock(ctx context.Context, key string) (bool, error) {
	// 使用 SETNX 实现分布式锁
	result, err := m.redis.SetNX(ctx, key, "1", m.lockTTL).Result()
	if err != nil {
		return false, err
	}

	if !result {
		// 等待并重试
		for i := 0; i < 10; i++ {
			time.Sleep(100 * time.Millisecond)
			result, err = m.redis.SetNX(ctx, key, "1", m.lockTTL).Result()
			if err != nil {
				return false, err
			}
			if result {
				return true, nil
			}
		}
		return false, nil
	}

	return true, nil
}

// releaseLock 释放分布式锁
func (m *Manager) releaseLock(ctx context.Context, key string) {
	if err := m.redis.Del(ctx, key).Err(); err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to release lock")
	}
}
