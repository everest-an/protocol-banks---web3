package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	HTTPPort    int

	Database DatabaseConfig
	Redis    RedisConfig
	Rain     RainConfig
	Transak  TransakConfig
}

type DatabaseConfig struct {
	URL string
}

type RedisConfig struct {
	URL        string
	Password   string
	DB         int
	TLSEnabled bool
}

type RainConfig struct {
	WebhookSecret    string
	APIKey           string
	APISecret        string
	BaseURL          string
	AuthorizationURL string
}

type TransakConfig struct {
	WebhookSecret string
	APIKey        string
	BaseURL       string
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("HTTP_PORT", "8080"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		HTTPPort:    port,
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL:        getEnv("REDIS_URL", "localhost:6379"),
			Password:   getEnv("REDIS_PASSWORD", ""),
			DB:         redisDB,
			TLSEnabled: getEnv("REDIS_TLS_ENABLED", "false") == "true",
		},
		Rain: RainConfig{
			WebhookSecret:    getEnv("RAIN_WEBHOOK_SECRET", ""),
			APIKey:           getEnv("RAIN_API_KEY", ""),
			APISecret:        getEnv("RAIN_API_SECRET", ""),
			BaseURL:          getEnv("RAIN_BASE_URL", "https://api.rain.com"),
			AuthorizationURL: getEnv("RAIN_AUTHORIZATION_URL", ""),
		},
		Transak: TransakConfig{
			WebhookSecret: getEnv("TRANSAK_WEBHOOK_SECRET", ""),
			APIKey:        getEnv("TRANSAK_API_KEY", ""),
			BaseURL:       getEnv("TRANSAK_BASE_URL", "https://api.transak.com"),
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
