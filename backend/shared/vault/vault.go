package vault

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	vault "github.com/hashicorp/vault/api"
	"github.com/rs/zerolog/log"
)

// Config Vault 配置
type Config struct {
	Address   string
	Token     string
	Namespace string
	MountPath string // 例如: "secret" 或 "kv"
	KeyPath   string // 例如: "protocol-bank/hot-wallet"
}

// Client Vault 客户端
type Client struct {
	client    *vault.Client
	config    Config
	keyCache  map[string]*ecdsa.PrivateKey
	cacheMu   sync.RWMutex
	cacheTTL  time.Duration
	cacheTime map[string]time.Time
}

// NewClient 创建 Vault 客户端
func NewClient(cfg Config) (*Client, error) {
	vaultCfg := vault.DefaultConfig()
	vaultCfg.Address = cfg.Address

	client, err := vault.NewClient(vaultCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create vault client: %w", err)
	}

	client.SetToken(cfg.Token)
	if cfg.Namespace != "" {
		client.SetNamespace(cfg.Namespace)
	}

	return &Client{
		client:    client,
		config:    cfg,
		keyCache:  make(map[string]*ecdsa.PrivateKey),
		cacheTTL:  5 * time.Minute,
		cacheTime: make(map[string]time.Time),
	}, nil
}

// GetPrivateKey 获取私钥（带缓存）
func (c *Client) GetPrivateKey(ctx context.Context, keyName string) (*ecdsa.PrivateKey, error) {
	// 检查缓存
	c.cacheMu.RLock()
	if key, ok := c.keyCache[keyName]; ok {
		if time.Since(c.cacheTime[keyName]) < c.cacheTTL {
			c.cacheMu.RUnlock()
			return key, nil
		}
	}
	c.cacheMu.RUnlock()

	// 从 Vault 获取
	path := fmt.Sprintf("%s/data/%s/%s", c.config.MountPath, c.config.KeyPath, keyName)
	secret, err := c.client.Logical().ReadWithContext(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to read secret from vault: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("secret not found: %s", keyName)
	}

	data, ok := secret.Data["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid secret format")
	}

	privateKeyHex, ok := data["private_key"].(string)
	if !ok {
		return nil, fmt.Errorf("private_key not found in secret")
	}

	// 移除 0x 前缀
	if len(privateKeyHex) > 2 && privateKeyHex[:2] == "0x" {
		privateKeyHex = privateKeyHex[2:]
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// 更新缓存
	c.cacheMu.Lock()
	c.keyCache[keyName] = privateKey
	c.cacheTime[keyName] = time.Now()
	c.cacheMu.Unlock()

	log.Info().Str("key_name", keyName).Msg("Loaded private key from Vault")

	return privateKey, nil
}

// StorePrivateKey 存储私钥
func (c *Client) StorePrivateKey(ctx context.Context, keyName string, privateKey *ecdsa.PrivateKey) error {
	privateKeyHex := hex.EncodeToString(crypto.FromECDSA(privateKey))
	address := crypto.PubkeyToAddress(privateKey.PublicKey).Hex()

	path := fmt.Sprintf("%s/data/%s/%s", c.config.MountPath, c.config.KeyPath, keyName)
	data := map[string]interface{}{
		"data": map[string]interface{}{
			"private_key": privateKeyHex,
			"address":     address,
			"created_at":  time.Now().UTC().Format(time.RFC3339),
		},
	}

	_, err := c.client.Logical().WriteWithContext(ctx, path, data)
	if err != nil {
		return fmt.Errorf("failed to write secret to vault: %w", err)
	}

	log.Info().Str("key_name", keyName).Str("address", address).Msg("Stored private key in Vault")

	return nil
}

// RotateKey 轮换密钥（保留旧密钥备份）
func (c *Client) RotateKey(ctx context.Context, keyName string) (*ecdsa.PrivateKey, error) {
	// 获取旧密钥
	oldKey, _ := c.GetPrivateKey(ctx, keyName)

	// 生成新密钥
	newKey, err := crypto.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate new key: %w", err)
	}

	// 备份旧密钥
	if oldKey != nil {
		backupName := fmt.Sprintf("%s_backup_%d", keyName, time.Now().Unix())
		if err := c.StorePrivateKey(ctx, backupName, oldKey); err != nil {
			log.Warn().Err(err).Msg("Failed to backup old key")
		}
	}

	// 存储新密钥
	if err := c.StorePrivateKey(ctx, keyName, newKey); err != nil {
		return nil, fmt.Errorf("failed to store new key: %w", err)
	}

	// 清除缓存
	c.cacheMu.Lock()
	delete(c.keyCache, keyName)
	delete(c.cacheTime, keyName)
	c.cacheMu.Unlock()

	newAddress := crypto.PubkeyToAddress(newKey.PublicKey).Hex()
	log.Info().
		Str("key_name", keyName).
		Str("new_address", newAddress).
		Msg("Key rotated successfully")

	return newKey, nil
}

// ClearCache 清除密钥缓存
func (c *Client) ClearCache() {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.keyCache = make(map[string]*ecdsa.PrivateKey)
	c.cacheTime = make(map[string]time.Time)
}

// Health 健康检查
func (c *Client) Health(ctx context.Context) error {
	health, err := c.client.Sys().HealthWithContext(ctx)
	if err != nil {
		return fmt.Errorf("vault health check failed: %w", err)
	}

	if !health.Initialized {
		return fmt.Errorf("vault is not initialized")
	}

	if health.Sealed {
		return fmt.Errorf("vault is sealed")
	}

	return nil
}
