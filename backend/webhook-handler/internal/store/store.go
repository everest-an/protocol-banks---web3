package store

import (
	"context"
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

	// 连接 Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisCfg.URL,
		Password: redisCfg.Password,
		DB:       redisCfg.DB,
	})

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
