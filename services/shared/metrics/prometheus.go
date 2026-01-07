package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Payout Engine Metrics
var (
	// 批量支付计数器
	PayoutBatchTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payout_batch_total",
			Help: "Total number of batch payouts submitted",
		},
		[]string{"status", "chain_id"},
	)

	// 单笔支付计数器
	PayoutTransactionTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payout_transaction_total",
			Help: "Total number of individual payout transactions",
		},
		[]string{"status", "chain_id", "token"},
	)

	// 支付金额
	PayoutAmountTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payout_amount_total",
			Help: "Total amount paid out (in wei for native, smallest unit for tokens)",
		},
		[]string{"chain_id", "token"},
	)

	// 支付处理时间
	PayoutProcessingDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "payout_processing_duration_seconds",
			Help:    "Time taken to process payouts",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120},
		},
		[]string{"chain_id", "batch_size_bucket"},
	)

	// Gas 使用量
	PayoutGasUsed = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "payout_gas_used",
			Help:    "Gas used for payout transactions",
			Buckets: []float64{21000, 50000, 100000, 200000, 500000, 1000000},
		},
		[]string{"chain_id", "token_type"},
	)

	// Nonce 管理
	NonceCurrentValue = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "nonce_current_value",
			Help: "Current nonce value per address per chain",
		},
		[]string{"chain_id", "address"},
	)

	NonceResetTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nonce_reset_total",
			Help: "Total number of nonce resets",
		},
		[]string{"chain_id", "reason"},
	)

	// 队列指标
	QueueDepth = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "payout_queue_depth",
			Help: "Number of jobs in the payout queue",
		},
		[]string{"chain_id", "priority"},
	)

	QueueProcessingRate = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "payout_queue_processing_rate",
			Help: "Jobs processed per second",
		},
		[]string{"chain_id"},
	)

	// 重试指标
	RetryTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payout_retry_total",
			Help: "Total number of payout retries",
		},
		[]string{"chain_id", "reason"},
	)

	// 错误指标
	ErrorTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payout_error_total",
			Help: "Total number of payout errors",
		},
		[]string{"chain_id", "error_type"},
	)
)

// Event Indexer Metrics
var (
	// 区块处理
	BlocksProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "indexer_blocks_processed_total",
			Help: "Total number of blocks processed",
		},
		[]string{"chain_id"},
	)

	BlockProcessingLag = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "indexer_block_lag",
			Help: "Number of blocks behind chain head",
		},
		[]string{"chain_id"},
	)

	// 事件处理
	EventsProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "indexer_events_processed_total",
			Help: "Total number of events processed",
		},
		[]string{"chain_id", "event_type"},
	)

	// WebSocket 连接
	WebsocketConnections = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "indexer_websocket_connections",
			Help: "Number of active WebSocket connections",
		},
		[]string{"chain_id"},
	)

	WebsocketReconnects = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "indexer_websocket_reconnects_total",
			Help: "Total number of WebSocket reconnections",
		},
		[]string{"chain_id"},
	)
)

// Webhook Handler Metrics
var (
	// Webhook 接收
	WebhookReceived = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "webhook_received_total",
			Help: "Total number of webhooks received",
		},
		[]string{"provider", "event_type"},
	)

	// 签名验证
	WebhookSignatureVerification = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "webhook_signature_verification_total",
			Help: "Webhook signature verification results",
		},
		[]string{"provider", "result"},
	)

	// 处理时间
	WebhookProcessingDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "webhook_processing_duration_seconds",
			Help:    "Time taken to process webhooks",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"provider", "event_type"},
	)

	// 幂等性检查
	WebhookDuplicateRejected = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "webhook_duplicate_rejected_total",
			Help: "Total number of duplicate webhooks rejected",
		},
		[]string{"provider"},
	)
)

// 通用服务指标
var (
	// 服务健康
	ServiceUp = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_up",
			Help: "Service health status (1 = up, 0 = down)",
		},
		[]string{"service"},
	)

	// gRPC 调用
	GRPCRequestTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_request_total",
			Help: "Total number of gRPC requests",
		},
		[]string{"service", "method", "status"},
	)

	GRPCRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_request_duration_seconds",
			Help:    "gRPC request duration",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"service", "method"},
	)

	// 数据库连接
	DBConnectionsActive = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "db_connections_active",
			Help: "Number of active database connections",
		},
		[]string{"service"},
	)

	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query duration",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
		},
		[]string{"service", "query_type"},
	)

	// Redis 连接
	RedisConnectionsActive = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "redis_connections_active",
			Help: "Number of active Redis connections",
		},
		[]string{"service"},
	)
)

// GetBatchSizeBucket 获取批量大小桶
func GetBatchSizeBucket(size int) string {
	switch {
	case size <= 10:
		return "1-10"
	case size <= 50:
		return "11-50"
	case size <= 100:
		return "51-100"
	case size <= 500:
		return "101-500"
	default:
		return "500+"
	}
}
