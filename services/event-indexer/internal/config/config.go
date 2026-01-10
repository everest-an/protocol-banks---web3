package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Environment string
	GRPCPort    int

	// Database
	Database DatabaseConfig

	// Redis
	Redis RedisConfig

	// Chains to watch
	Chains map[uint64]ChainConfig

	// Watched addresses (comma-separated in env)
	WatchedAddresses []string
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
	ChainID       uint64
	Name          string
	RPCURL        string
	WSURL         string // WebSocket URL for subscriptions
	ExplorerURL   string
	StartBlock    uint64
	Confirmations uint64
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("GRPC_PORT", "50052"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	// Parse watched addresses
	watchedAddrs := []string{}
	if addrs := getEnv("WATCHED_ADDRESSES", ""); addrs != "" {
		watchedAddrs = strings.Split(addrs, ",")
	}

	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		GRPCPort:    port,
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       redisDB,
		},
		WatchedAddresses: watchedAddrs,
		Chains: map[uint64]ChainConfig{
			1: {
				ChainID:       1,
				Name:          "Ethereum",
				RPCURL:        getEnv("ETH_RPC_URL", "https://eth.llamarpc.com"),
				WSURL:         getEnv("ETH_WS_URL", "wss://eth.llamarpc.com"),
				ExplorerURL:   "https://etherscan.io",
				StartBlock:    0, // 0 = latest
				Confirmations: 12,
			},
			137: {
				ChainID:       137,
				Name:          "Polygon",
				RPCURL:        getEnv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
				WSURL:         getEnv("POLYGON_WS_URL", "wss://polygon-rpc.com"),
				ExplorerURL:   "https://polygonscan.com",
				StartBlock:    0,
				Confirmations: 128,
			},
			8453: {
				ChainID:       8453,
				Name:          "Base",
				RPCURL:        getEnv("BASE_RPC_URL", "https://mainnet.base.org"),
				WSURL:         getEnv("BASE_WS_URL", "wss://mainnet.base.org"),
				ExplorerURL:   "https://basescan.org",
				StartBlock:    0,
				Confirmations: 12,
			},
			42161: {
				ChainID:       42161,
				Name:          "Arbitrum",
				RPCURL:        getEnv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
				WSURL:         getEnv("ARBITRUM_WS_URL", "wss://arb1.arbitrum.io/rpc"),
				ExplorerURL:   "https://arbiscan.io",
				StartBlock:    0,
				Confirmations: 12,
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
