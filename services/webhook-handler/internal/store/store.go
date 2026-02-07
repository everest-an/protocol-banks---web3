package store

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"github.com/protocol-bank/webhook-handler/internal/config"
)

// WebhookStore Webhook 存储
type WebhookStore struct {
	db    *sql.DB
	redis *redis.Client
}

// NewWebhookStore 创建存储
func NewWebhookStore(ctx context.Context, dbURL string, redisCfg config.RedisConfig) (*WebhookStore, error) {
	// 连接数据库
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// 连接 Redis (支持 TLS)
	redisOpts := &redis.Options{
		Addr:     redisCfg.URL,
		Password: redisCfg.Password,
		DB:       redisCfg.DB,
	}
	if redisCfg.TLSEnabled {
		redisOpts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	rdb := redis.NewClient(redisOpts)

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &WebhookStore{
		db:    db,
		redis: rdb,
	}, nil
}

// IsProcessed 检查是否已处理
func (s *WebhookStore) IsProcessed(ctx context.Context, eventID string) (bool, error) {
	key := fmt.Sprintf("webhook:processed:%s", eventID)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}

// MarkProcessed 标记为已处理
func (s *WebhookStore) MarkProcessed(ctx context.Context, eventID, payload string) error {
	key := fmt.Sprintf("webhook:processed:%s", eventID)
	// 保存 7 天
	return s.redis.Set(ctx, key, payload, 7*24*time.Hour).Err()
}

// SaveWebhook 保存 Webhook 记录到数据库
func (s *WebhookStore) SaveWebhook(ctx context.Context, source, eventType, eventID, payload string) error {
	query := `
		INSERT INTO webhooks (source, event_type, event_id, payload, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (event_id) DO NOTHING
	`
	_, err := s.db.ExecContext(ctx, query, source, eventType, eventID, payload)
	return err
}

// Close 关闭连接
func (s *WebhookStore) Close() error {
	if err := s.db.Close(); err != nil {
		return err
	}
	return s.redis.Close()
}

// ============================================================================
// Business Logic Methods (Added for RWA/Fiat Support)
// ============================================================================

// UpsertFiatOrder Create or update a fiat order (Transak)
func (s *WebhookStore) UpsertFiatOrder(ctx context.Context, orderID, status string, amount float64, currency, wallet, txHash string) error {
	// Note: We use raw SQL here. In a real scenario, use Prisma/GORM or a query builder.
	query := `
		INSERT INTO fiat_orders (order_id, status, fiat_amount, fiat_currency, wallet_address, tx_hash, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (order_id) DO UPDATE SET
			status = EXCLUDED.status,
			tx_hash = EXCLUDED.tx_hash,
			updated_at = NOW()
	`
	_, err := s.db.ExecContext(ctx, query, orderID, status, amount, currency, wallet, txHash)
	return err
}

// UpdateCardTransaction Records a corporate card transaction (Rain)
func (s *WebhookStore) UpdateCardTransaction(ctx context.Context, txID, cardID, merchant string, amount float64, currency, status string) error {
	// 1. Get internal Card ID mapping
	var internalID string
	err := s.db.QueryRowContext(ctx, "SELECT id FROM corporate_cards WHERE external_id = $1", cardID).Scan(&internalID)
	if err == sql.ErrNoRows {
		// Log warning or create implicit card placeholder? For now, error out.
		return fmt.Errorf("corporate card %s not found", cardID)
	} else if err != nil {
		return err
	}

	// 2. Insert/Update Transaction
	query := `
		INSERT INTO card_transactions (external_id, card_id, merchant_name, amount, currency, status, type, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'SETTLEMENT', NOW())
		ON CONFLICT (external_id) DO UPDATE SET
			status = EXCLUDED.status,
			updated_at = NOW()
	`
	_, err = s.db.ExecContext(ctx, query, txID, internalID, merchant, amount, currency, status)
	return err
}

// UpdateCardBalance Updates the card balance
func (s *WebhookStore) UpdateCardBalance(ctx context.Context, cardID string, amount float64) error {
	query := `
		UPDATE corporate_cards 
		SET balance = balance - $2, updated_at = NOW() 
		WHERE external_id = $1
	`
	// Note: Subtract amount for spending
	_, err := s.db.ExecContext(ctx, query, cardID, amount)
	return err
}

// GetCardBalance Retrieves current balance
func (s *WebhookStore) GetCardBalance(ctx context.Context, cardID string) (float64, error) {
	var balance float64
	err := s.db.QueryRowContext(ctx, "SELECT balance FROM corporate_cards WHERE external_id = $1", cardID).Scan(&balance)
	return balance, err
}

// UpsertCardStatus Creates or updates a corporate card record
func (s *WebhookStore) UpsertCardStatus(ctx context.Context, externalID, userID, last4, status string) error {
	query := `
		INSERT INTO corporate_cards (id, external_id, user_id, last4, status, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
		ON CONFLICT (external_id) DO UPDATE SET
			status = EXCLUDED.status,
			last4 = EXCLUDED.last4,
			updated_at = NOW()
	`
	_, err := s.db.ExecContext(ctx, query, externalID, userID, last4, status)
	return err
}

// UpdateCardStatusByExternalID Updates card status by Rain external card ID
func (s *WebhookStore) UpdateCardStatusByExternalID(ctx context.Context, externalID, status string) error {
	query := `UPDATE corporate_cards SET status = $2, updated_at = NOW() WHERE external_id = $1`
	_, err := s.db.ExecContext(ctx, query, externalID, status)
	return err
}
