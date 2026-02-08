package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	GRPCPort    int
	APISecret   string
	PrivateKey  string // EVM Payout Signing Key

	// TRON-specific
	TronPrivateKey string // TRON Payout Signing Key (separate from EVM)
	TRC20FeeLimit  int64  // Fee limit for TRC20 transfers (in SUN, default 100 TRX)

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
	URL        string
	Password   string
	DB         int
	TLSEnabled bool // Enable TLS for production Redis
}

type ChainConfig struct {
	ChainID     uint64
	Name        string
	RPCURL      string
	ExplorerURL string
	NativeToken string
	Decimals    int
	Type        string // "evm" or "tron"
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("GRPC_PORT", "50051"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	trc20FeeLimit, _ := strconv.ParseInt(getEnv("TRC20_FEE_LIMIT", "100000000"), 10, 64)
	if trc20FeeLimit <= 0 {
		trc20FeeLimit = 100_000_000 // 100 TRX default
	}

	cfg := &Config{
		Environment:    getEnv("ENVIRONMENT", "development"),
		GRPCPort:       port,
		APISecret:      getEnv("API_SECRET", ""),
		PrivateKey:     getEnv("PAYOUT_PRIVATE_KEY", ""),
		TronPrivateKey: getEnv("TRON_PRIVATE_KEY", ""),
		TRC20FeeLimit:  trc20FeeLimit,
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL:        getEnv("REDIS_URL", "localhost:6379"),
			Password:   getEnv("REDIS_PASSWORD", ""),
			DB:         redisDB,
			TLSEnabled: getEnv("REDIS_TLS_ENABLED", "false") == "true",
		},
		Chains: map[uint64]ChainConfig{
			// ——— EVM Chains ———
			1: {
				ChainID:     1,
				Name:        "Ethereum",
				RPCURL:      getEnv("ETH_RPC_URL", "https://eth.llamarpc.com"),
				ExplorerURL: "https://etherscan.io",
				NativeToken: "ETH",
				Decimals:    18,
				Type:        "evm",
			},
			137: {
				ChainID:     137,
				Name:        "Polygon",
				RPCURL:      getEnv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
				ExplorerURL: "https://polygonscan.com",
				NativeToken: "MATIC",
				Decimals:    18,
				Type:        "evm",
			},
			42161: {
				ChainID:     42161,
				Name:        "Arbitrum",
				RPCURL:      getEnv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
				ExplorerURL: "https://arbiscan.io",
				NativeToken: "ETH",
				Decimals:    18,
				Type:        "evm",
			},
			8453: {
				ChainID:     8453,
				Name:        "Base",
				RPCURL:      getEnv("BASE_RPC_URL", "https://mainnet.base.org"),
				ExplorerURL: "https://basescan.org",
				NativeToken: "ETH",
				Decimals:    18,
				Type:        "evm",
			},
			10: {
				ChainID:     10,
				Name:        "Optimism",
				RPCURL:      getEnv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
				ExplorerURL: "https://optimistic.etherscan.io",
				NativeToken: "ETH",
				Decimals:    18,
				Type:        "evm",
			},
			// ——— TRON Chains ———
			728126428: {
				ChainID:     728126428,
				Name:        "TRON Mainnet",
				RPCURL:      getEnv("TRON_RPC_URL", "grpc.trongrid.io:50051"),
				ExplorerURL: "https://tronscan.org",
				NativeToken: "TRX",
				Decimals:    6,
				Type:        "tron",
			},
			3448148188: {
				ChainID:     3448148188,
				Name:        "TRON Nile Testnet",
				RPCURL:      getEnv("TRON_TESTNET_RPC_URL", "grpc.nile.trongrid.io:50051"),
				ExplorerURL: "https://nile.tronscan.org",
				NativeToken: "TRX",
				Decimals:    6,
				Type:        "tron",
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
