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

// CardUserInfo 卡用户信息
type CardUserInfo struct {
	UserID        string
	WalletAddress string
	Balance       float64
	DailyLimit    float64
	MonthlyLimit  float64
	SingleTxLimit float64
	DailySpent    float64
	MonthlySpent  float64
	IsActive      bool
}

// GetCardUserInfo 获取卡用户信息
func (s *WebhookStore) GetCardUserInfo(ctx context.Context, cardID string) (*CardUserInfo, error) {
	query := `
		SELECT
			c.user_id,
			c.wallet_address,
			COALESCE(c.balance, 0) as balance,
			COALESCE(c.daily_limit, 10000) as daily_limit,
			COALESCE(c.monthly_limit, 100000) as monthly_limit,
			COALESCE(c.single_tx_limit, 5000) as single_tx_limit,
			COALESCE(c.is_active, true) as is_active
		FROM rain_cards c
		WHERE c.card_id = $1
	`

	var info CardUserInfo
	err := s.db.QueryRowContext(ctx, query, cardID).Scan(
		&info.UserID,
		&info.WalletAddress,
		&info.Balance,
		&info.DailyLimit,
		&info.MonthlyLimit,
		&info.SingleTxLimit,
		&info.IsActive,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get card user info: %w", err)
	}

	// 获取当日和当月已花费金额
	spentQuery := `
		SELECT
			COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount ELSE 0 END), 0) as daily_spent,
			COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN amount ELSE 0 END), 0) as monthly_spent
		FROM rain_transactions
		WHERE card_id = $1 AND status IN ('approved', 'settled')
	`
	err = s.db.QueryRowContext(ctx, spentQuery, cardID).Scan(&info.DailySpent, &info.MonthlySpent)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get spending info: %w", err)
	}

	return &info, nil
}

// IsMerchantBlacklisted 检查商户是否在黑名单
func (s *WebhookStore) IsMerchantBlacklisted(ctx context.Context, merchantName, mcc string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM rain_merchant_blacklist
			WHERE (merchant_name = $1 OR mcc = $2) AND is_active = true
		)
	`

	var exists bool
	err := s.db.QueryRowContext(ctx, query, merchantName, mcc).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check merchant blacklist: %w", err)
	}

	return exists, nil
}

// RecordAuthorization 记录授权请求
func (s *WebhookStore) RecordAuthorization(ctx context.Context, authID, cardID, userID, merchantName string, amount float64, approved bool, reason string) error {
	query := `
		INSERT INTO rain_authorizations (authorization_id, card_id, user_id, merchant_name, amount, approved, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`
	_, err := s.db.ExecContext(ctx, query, authID, cardID, userID, merchantName, amount, approved, reason)
	return err
}

// SaveRainTransaction 保存 Rain 交易记录
func (s *WebhookStore) SaveRainTransaction(ctx context.Context, txID, cardID, userID, merchantName, mcc string, amount float64, currency, status string) error {
	query := `
		INSERT INTO rain_transactions (transaction_id, card_id, user_id, merchant_name, merchant_category_code, amount, currency, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (transaction_id) DO UPDATE SET
			status = $8,
			updated_at = NOW()
	`
	_, err := s.db.ExecContext(ctx, query, txID, cardID, userID, merchantName, mcc, amount, currency, status)
	return err
}

// UpdateCardStatus 更新卡片状态
func (s *WebhookStore) UpdateCardStatus(ctx context.Context, cardID, status string) error {
	query := `
		UPDATE rain_cards SET status = $2, updated_at = NOW()
		WHERE card_id = $1
	`
	_, err := s.db.ExecContext(ctx, query, cardID, status)
	return err
}

// ProcessSettlement 处理结算
func (s *WebhookStore) ProcessSettlement(ctx context.Context, settlementID, cardID, userID string, amount float64, currency string) error {
	// 开始事务
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 记录结算
	_, err = tx.ExecContext(ctx, `
		INSERT INTO rain_settlements (settlement_id, card_id, user_id, amount, currency, status, created_at)
		VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
	`, settlementID, cardID, userID, amount, currency)
	if err != nil {
		return fmt.Errorf("failed to insert settlement: %w", err)
	}

	// 更新用户余额 (扣除结算金额)
	_, err = tx.ExecContext(ctx, `
		UPDATE rain_cards SET balance = balance - $2, updated_at = NOW()
		WHERE card_id = $1
	`, cardID, amount)
	if err != nil {
		return fmt.Errorf("failed to update balance: %w", err)
	}

	return tx.Commit()
}

// CreateNotification 创建用户通知
func (s *WebhookStore) CreateNotification(ctx context.Context, userID, notifType, title, message string) error {
	query := `
		INSERT INTO notifications (user_id, type, title, message, read, created_at)
		VALUES ($1, $2, $3, $4, false, NOW())
	`
	_, err := s.db.ExecContext(ctx, query, userID, notifType, title, message)
	return err
}

// SaveTransakPurchase 保存 Transak 购买记录
func (s *WebhookStore) SaveTransakPurchase(ctx context.Context, orderID, walletAddress string, fiatAmount float64, fiatCurrency string, cryptoAmount float64, cryptoCurrency, network, txHash string) error {
	query := `
		INSERT INTO transak_purchases (
			order_id, wallet_address, fiat_amount, fiat_currency,
			crypto_amount, crypto_currency, network, tx_hash, status, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW())
		ON CONFLICT (order_id) DO UPDATE SET
			status = 'completed',
			tx_hash = $8,
			completed_at = NOW()
	`
	_, err := s.db.ExecContext(ctx, query, orderID, walletAddress, fiatAmount, fiatCurrency, cryptoAmount, cryptoCurrency, network, txHash)
	return err
}
