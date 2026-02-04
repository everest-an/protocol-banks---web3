package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/protocol-bank/payout-engine/internal/config"
	"github.com/protocol-bank/payout-engine/internal/handler"
	"github.com/protocol-bank/payout-engine/internal/nonce"
	"github.com/protocol-bank/payout-engine/internal/queue"
	"github.com/protocol-bank/payout-engine/internal/service"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
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

	log.Info().Str("env", cfg.Environment).Msg("Starting Payout Engine")

	// 初始化组件
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Nonce 管理器
	nonceManager, err := nonce.NewManager(ctx, cfg.Redis)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize nonce manager")
	}

	// 队列消费者
	queueConsumer, err := queue.NewConsumer(ctx, cfg.Redis)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize queue consumer")
	}

	// 支付服务
	payoutService, err := service.NewPayoutService(ctx, cfg, nonceManager, queueConsumer)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize payout service")
	}

	// 启动队列消费者
	go queueConsumer.Start(ctx, payoutService.ProcessJob)

	// 启动 gRPC 服务器
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to listen")
	}

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(handler.AuthInterceptor(cfg.APISecret)),
		grpc.StreamInterceptor(handler.StreamAuthInterceptor(cfg.APISecret)),
	)

	handler.RegisterPayoutServer(grpcServer, payoutService)
	reflection.Register(grpcServer)

	go func() {
		log.Info().Int("port", cfg.GRPCPort).Msg("gRPC server listening")
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatal().Err(err).Msg("Failed to serve gRPC")
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down...")
	grpcServer.GracefulStop()
	cancel()
	log.Info().Msg("Payout Engine stopped")
}
