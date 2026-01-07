package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/protocol-bank/event-indexer/internal/config"
	"github.com/protocol-bank/event-indexer/internal/watcher"
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

	log.Info().Str("env", cfg.Environment).Msg("Starting Event Indexer")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 创建多链监听器
	multiChainWatcher, err := watcher.NewMultiChainWatcher(ctx, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create multi-chain watcher")
	}

	// 启动监听
	go multiChainWatcher.Start(ctx)

	// 启动 gRPC 服务器
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to listen")
	}

	grpcServer := grpc.NewServer()
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
	log.Info().Msg("Event Indexer stopped")
}
