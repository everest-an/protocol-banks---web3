package queue

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/protocol-bank/payout-engine/internal/config"
	"github.com/rs/zerolog/log"
)

const (
	PayoutQueueKey      = "payout:queue"
	PayoutProcessingKey = "payout:processing"
	PayoutDeadLetterKey = "payout:deadletter"
	MaxRetries          = 3
)

// Job 支付任务
type Job struct {
	ID            string          `json:"id"`
	BatchID       string          `json:"batch_id"`
	UserID        string          `json:"user_id"`
	FromAddress   string          `json:"from_address"`
	ToAddress     string          `json:"to_address"`
	Amount        string          `json:"amount"`
	TokenAddress  string          `json:"token_address"`
	TokenSymbol   string          `json:"token_symbol"`
	TokenDecimals uint32          `json:"token_decimals"`
	ChainID       uint64          `json:"chain_id"`
	RetryCount    int             `json:"retry_count"`
	CreatedAt     time.Time       `json:"created_at"`
	Metadata      json.RawMessage `json:"metadata,omitempty"`
}

// JobResult 任务结果
type JobResult struct {
	JobID   string
	Success bool
	TxHash  string
	Error   error
}

// ProcessFunc 任务处理函数
type ProcessFunc func(ctx context.Context, job *Job) (*JobResult, error)

// Consumer 队列消费者
type Consumer struct {
	redis      *redis.Client
	workerPool int
}

// NewConsumer 创建队列消费者
func NewConsumer(ctx context.Context, cfg config.RedisConfig) (*Consumer, error) {
	var rdb *redis.Client

	// Try to parse as connection URL first if likely a URL
	if len(cfg.URL) > 8 && (cfg.URL[:8] == "redis://" || cfg.URL[:9] == "rediss://") {
		opts, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, fmt.Errorf("invalid redis url: %w", err)
		}
		if cfg.TLSEnabled && opts.TLSConfig == nil {
			opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
		}
		rdb = redis.NewClient(opts)
	} else {
		opts := &redis.Options{
			Addr:     cfg.URL,
			Password: cfg.Password,
			DB:       cfg.DB,
		}
		if cfg.TLSEnabled {
			opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
		}
		rdb = redis.NewClient(opts)
	}

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	return &Consumer{
		redis:      rdb,
		workerPool: 10, // 并发工作线程数
	}, nil
}

// Push 添加任务到队列
func (c *Consumer) Push(ctx context.Context, job *Job) error {
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	return c.redis.LPush(ctx, PayoutQueueKey, data).Err()
}

// PushBatch 批量添加任务
func (c *Consumer) PushBatch(ctx context.Context, jobs []*Job) error {
	pipe := c.redis.Pipeline()
	for _, job := range jobs {
		data, err := json.Marshal(job)
		if err != nil {
			return fmt.Errorf("failed to marshal job: %w", err)
		}
		pipe.LPush(ctx, PayoutQueueKey, data)
	}
	_, err := pipe.Exec(ctx)
	return err
}

// Start 启动消费者
func (c *Consumer) Start(ctx context.Context, processFn ProcessFunc) {
	log.Info().Int("workers", c.workerPool).Msg("Starting queue consumer")

	// 启动多个工作协程
	for i := 0; i < c.workerPool; i++ {
		go c.worker(ctx, i, processFn)
	}
}

// worker 工作协程
func (c *Consumer) worker(ctx context.Context, id int, processFn ProcessFunc) {
	log.Info().Int("worker_id", id).Msg("Worker started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Int("worker_id", id).Msg("Worker stopped")
			return
		default:
			// 从队列获取任务（阻塞等待 5 秒）
			result, err := c.redis.BRPopLPush(ctx, PayoutQueueKey, PayoutProcessingKey, 5*time.Second).Result()
			if err == redis.Nil {
				continue // 超时，继续等待
			}
			if err != nil {
				log.Error().Err(err).Int("worker_id", id).Msg("Failed to pop from queue")
				continue
			}

			// 解析任务
			var job Job
			if err := json.Unmarshal([]byte(result), &job); err != nil {
				log.Error().Err(err).Str("data", result).Msg("Failed to unmarshal job")
				c.removeFromProcessing(ctx, result)
				continue
			}

			log.Info().
				Str("job_id", job.ID).
				Str("batch_id", job.BatchID).
				Int("worker_id", id).
				Msg("Processing job")

			// 处理任务
			jobResult, err := processFn(ctx, &job)
			if err != nil {
				c.handleFailure(ctx, &job, result, err)
			} else if !jobResult.Success {
				c.handleFailure(ctx, &job, result, jobResult.Error)
			} else {
				c.handleSuccess(ctx, &job, result, jobResult.TxHash)
			}
		}
	}
}

// handleSuccess 处理成功
func (c *Consumer) handleSuccess(ctx context.Context, job *Job, rawData string, txHash string) {
	log.Info().
		Str("job_id", job.ID).
		Str("tx_hash", txHash).
		Msg("Job completed successfully")

	c.removeFromProcessing(ctx, rawData)
}

// handleFailure 处理失败
func (c *Consumer) handleFailure(ctx context.Context, job *Job, rawData string, err error) {
	job.RetryCount++

	if job.RetryCount >= MaxRetries {
		log.Error().
			Str("job_id", job.ID).
			Int("retries", job.RetryCount).
			Err(err).
			Msg("Job exceeded max retries, moving to dead letter queue")

		// 移到死信队列
		data, _ := json.Marshal(job)
		c.redis.LPush(ctx, PayoutDeadLetterKey, data)
		c.removeFromProcessing(ctx, rawData)
		return
	}

	log.Warn().
		Str("job_id", job.ID).
		Int("retry_count", job.RetryCount).
		Err(err).
		Msg("Job failed, requeueing")

	// 重新入队（延迟重试）
	time.Sleep(time.Duration(job.RetryCount) * 5 * time.Second)
	data, _ := json.Marshal(job)
	c.redis.LPush(ctx, PayoutQueueKey, data)
	c.removeFromProcessing(ctx, rawData)
}

// removeFromProcessing 从处理中列表移除
func (c *Consumer) removeFromProcessing(ctx context.Context, rawData string) {
	c.redis.LRem(ctx, PayoutProcessingKey, 1, rawData)
}

// GetQueueLength 获取队列长度
func (c *Consumer) GetQueueLength(ctx context.Context) (int64, error) {
	return c.redis.LLen(ctx, PayoutQueueKey).Result()
}

// GetProcessingCount 获取处理中数量
func (c *Consumer) GetProcessingCount(ctx context.Context) (int64, error) {
	return c.redis.LLen(ctx, PayoutProcessingKey).Result()
}

// GetDeadLetterCount 获取死信队列数量
func (c *Consumer) GetDeadLetterCount(ctx context.Context) (int64, error) {
	return c.redis.LLen(ctx, PayoutDeadLetterKey).Result()
}
