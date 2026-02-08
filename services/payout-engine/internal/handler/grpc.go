package handler

import (
	"context"
	"crypto/subtle"

	"github.com/protocol-bank/payout-engine/internal/service"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// PayoutServer gRPC 服务实现
type PayoutServer struct {
	service *service.PayoutService
}

// RegisterPayoutServer 注册 gRPC 服务
func RegisterPayoutServer(s *grpc.Server, svc *service.PayoutService) {
	// 注册到 gRPC 服务器
	// pb.RegisterPayoutServiceServer(s, &PayoutServer{service: svc})
	log.Info().Msg("Payout gRPC server registered")
}

// AuthInterceptor 认证拦截器
func AuthInterceptor(apiSecret string) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		// 跳过健康检查
		if info.FullMethod == "/grpc.health.v1.Health/Check" {
			return handler(ctx, req)
		}

		// 验证 API Key
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		apiKeys := md.Get("x-api-key")
		if len(apiKeys) == 0 || subtle.ConstantTimeCompare([]byte(apiKeys[0]), []byte(apiSecret)) != 1 {
			log.Warn().Str("method", info.FullMethod).Msg("Unauthorized request")
			return nil, status.Error(codes.Unauthenticated, "invalid api key")
		}

		return handler(ctx, req)
	}
}

// StreamAuthInterceptor 流式认证拦截器
func StreamAuthInterceptor(apiSecret string) grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		ss grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		// 验证 API Key
		md, ok := metadata.FromIncomingContext(ss.Context())
		if !ok {
			return status.Error(codes.Unauthenticated, "missing metadata")
		}

		apiKeys := md.Get("x-api-key")
		if len(apiKeys) == 0 || subtle.ConstantTimeCompare([]byte(apiKeys[0]), []byte(apiSecret)) != 1 {
			log.Warn().Str("method", info.FullMethod).Msg("Unauthorized stream request")
			return status.Error(codes.Unauthenticated, "invalid api key")
		}

		return handler(srv, ss)
	}
}
