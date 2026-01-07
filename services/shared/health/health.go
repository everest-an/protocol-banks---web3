package health

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// Status 健康状态
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusDegraded  Status = "degraded"
	StatusUnhealthy Status = "unhealthy"
)

// CheckResult 健康检查结果
type CheckResult struct {
	Status    Status        `json:"status"`
	Message   string        `json:"message,omitempty"`
	Duration  time.Duration `json:"duration_ms"`
	Timestamp time.Time     `json:"timestamp"`
}

// HealthResponse 健康响应
type HealthResponse struct {
	Status    Status                  `json:"status"`
	Service   string                  `json:"service"`
	Version   string                  `json:"version"`
	Uptime    string                  `json:"uptime"`
	Checks    map[string]CheckResult  `json:"checks"`
	Timestamp time.Time               `json:"timestamp"`
}

// Check 健康检查函数类型
type Check func(ctx context.Context) CheckResult

// Checker 健康检查器
type Checker struct {
	service   string
	version   string
	startTime time.Time
	checks    map[string]Check
	mu        sync.RWMutex
}

// NewChecker 创建健康检查器
func NewChecker(service, version string) *Checker {
	return &Checker{
		service:   service,
		version:   version,
		startTime: time.Now(),
		checks:    make(map[string]Check),
	}
}

// RegisterCheck 注册健康检查
func (c *Checker) RegisterCheck(name string, check Check) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.checks[name] = check
}

// Run 运行所有健康检查
func (c *Checker) Run(ctx context.Context) HealthResponse {
	c.mu.RLock()
	defer c.mu.RUnlock()

	results := make(map[string]CheckResult)
	overallStatus := StatusHealthy
	var wg sync.WaitGroup

	resultChan := make(chan struct {
		name   string
		result CheckResult
	}, len(c.checks))

	// 并发执行检查
	for name, check := range c.checks {
		wg.Add(1)
		go func(n string, ch Check) {
			defer wg.Done()
			start := time.Now()
			result := ch(ctx)
			result.Duration = time.Since(start)
			result.Timestamp = time.Now()
			resultChan <- struct {
				name   string
				result CheckResult
			}{n, result}
		}(name, check)
	}

	// 等待所有检查完成
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// 收集结果
	for r := range resultChan {
		results[r.name] = r.result
		if r.result.Status == StatusUnhealthy {
			overallStatus = StatusUnhealthy
		} else if r.result.Status == StatusDegraded && overallStatus != StatusUnhealthy {
			overallStatus = StatusDegraded
		}
	}

	return HealthResponse{
		Status:    overallStatus,
		Service:   c.service,
		Version:   c.version,
		Uptime:    time.Since(c.startTime).String(),
		Checks:    results,
		Timestamp: time.Now(),
	}
}

// HTTPHandler 返回 HTTP 处理器
func (c *Checker) HTTPHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		response := c.Run(ctx)

		w.Header().Set("Content-Type", "application/json")
		if response.Status == StatusUnhealthy {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else if response.Status == StatusDegraded {
			w.WriteHeader(http.StatusOK) // 仍然返回 200，但状态是 degraded
		}

		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Error().Err(err).Msg("Failed to encode health response")
		}
	}
}

// LivenessHandler 存活探针
func (c *Checker) LivenessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "alive",
		})
	}
}

// ReadinessHandler 就绪探针
func (c *Checker) ReadinessHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		response := c.Run(ctx)

		w.Header().Set("Content-Type", "application/json")
		if response.Status == StatusUnhealthy {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"status": "not_ready",
			})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ready",
		})
	}
}

// 常用健康检查

// DatabaseCheck 数据库健康检查
func DatabaseCheck(pingFn func(ctx context.Context) error) Check {
	return func(ctx context.Context) CheckResult {
		if err := pingFn(ctx); err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: err.Error(),
			}
		}
		return CheckResult{Status: StatusHealthy}
	}
}

// RedisCheck Redis 健康检查
func RedisCheck(pingFn func(ctx context.Context) error) Check {
	return func(ctx context.Context) CheckResult {
		if err := pingFn(ctx); err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: err.Error(),
			}
		}
		return CheckResult{Status: StatusHealthy}
	}
}

// ChainCheck 区块链节点健康检查
func ChainCheck(chainID uint64, blockNumberFn func(ctx context.Context) (uint64, error)) Check {
	return func(ctx context.Context) CheckResult {
		blockNum, err := blockNumberFn(ctx)
		if err != nil {
			return CheckResult{
				Status:  StatusUnhealthy,
				Message: err.Error(),
			}
		}
		return CheckResult{
			Status:  StatusHealthy,
			Message: "block: " + string(rune(blockNum)),
		}
	}
}
