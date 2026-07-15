package config

import (
	"os"
)

type Config struct {
	Port      string
	JWTSecret string
	DBPath    string
	Mode      string
}

func Load() *Config {
	return &Config{
		Port:      getEnv("PORT", "8080"),
		JWTSecret: getEnv("JWT_SECRET", "ranpak-cloud-default-secret-change-me"),
		DBPath:    getEnv("DB_PATH", "./data/ranpak.db"),
		Mode:      getEnv("GIN_MODE", "debug"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
