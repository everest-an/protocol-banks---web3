package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	GRPCPort    int
	APISecret   string

	// Database
	Database DatabaseConfig

	// Redis
	Redis RedisConfig

	// Blockchain
	Chains map[uint64]ChainConfig
}

type DatabaseConfig struct {
	URL string
}

type RedisConfig struct {
	URL      string
	Password string
	DB       int
}

type ChainConfig struct {
	ChainID     uint64
	Name        string
	RPCURL      string
	ExplorerURL string
	NativeToken string
	Decimals    int
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("GRPC_PORT", "50051"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		GRPCPort:    port,
		APISecret:   getEnv("API_SECRET", ""),
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       redisDB,
		},
		Chains: map[uint64]ChainConfig{
			1: {
				ChainID:     1,
				Name:        "Ethereum",
				RPCURL:      getEnv("ETH_RPC_URL", "https://eth.llamarpc.com"),
				ExplorerURL: "https://etherscan.io",
				NativeToken: "ETH",
				Decimals:    18,
			},
			137: {
				ChainID:     137,
				Name:        "Polygon",
				RPCURL:      getEnv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
				ExplorerURL: "https://polygonscan.com",
				NativeToken: "MATIC",
				Decimals:    18,
			},
			42161: {
				ChainID:     42161,
				Name:        "Arbitrum",
				RPCURL:      getEnv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
				ExplorerURL: "https://arbiscan.io",
				NativeToken: "ETH",
				Decimals:    18,
			},
			8453: {
				ChainID:     8453,
				Name:        "Base",
				RPCURL:      getEnv("BASE_RPC_URL", "https://mainnet.base.org"),
				ExplorerURL: "https://basescan.org",
				NativeToken: "ETH",
				Decimals:    18,
			},
			10: {
				ChainID:     10,
				Name:        "Optimism",
				RPCURL:      getEnv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
				ExplorerURL: "https://optimistic.etherscan.io",
				NativeToken: "ETH",
				Decimals:    18,
			},
		},
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
