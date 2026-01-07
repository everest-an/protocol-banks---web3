package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/protocol-bank/webhook-handler/internal/config"
	"github.com/protocol-bank/webhook-handler/internal/handler"
	"github.com/protocol-bank/webhook-handler/internal/store"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// 初始化日志
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	log.Info().Str("env", cfg.Environment).Msg("Starting Webhook Handler")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 初始化存储
	webhookStore, err := store.NewWebhookStore(ctx, cfg.Database.URL, cfg.Redis)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize store")
	}

	// 创建处理器
	rainHandler := handler.NewRainHandler(cfg.Rain, webhookStore)
	transakHandler := handler.NewTransakHandler(cfg.Transak, webhookStore)

	// 设置路由
	r := chi.NewRouter()

	// 中间件
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// 健康检查
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Webhook 路由
	r.Route("/webhooks", func(r chi.Router) {
		r.Post("/rain", rainHandler.HandleWebhook)
		r.Post("/rain/auth", rainHandler.HandleAuthorizationRequest)
		r.Post("/transak", transakHandler.HandleWebhook)
	})

	// 启动 HTTP 服务器
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.HTTPPort).Msg("HTTP server listening")
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server error")
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("HTTP server shutdown error")
	}

	cancel()
	log.Info().Msg("Webhook Handler stopped")
}
