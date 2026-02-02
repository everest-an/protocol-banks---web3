// Package kms provides key management service integrations for secure transaction signing
package kms

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Signer is the interface for transaction signing services
type Signer interface {
	// GetAddress returns the Ethereum address associated with this signer
	GetAddress(ctx context.Context) (common.Address, error)

	// SignTransaction signs a transaction and returns the signed transaction
	SignTransaction(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error)

	// SignHash signs a hash and returns the signature
	SignHash(ctx context.Context, hash []byte) ([]byte, error)

	// Close releases any resources held by the signer
	Close() error
}

// Provider represents a KMS provider type
type Provider string

const (
	ProviderLocal     Provider = "local"     // Local private key (development only)
	ProviderAWSKMS    Provider = "aws"       // AWS Key Management Service
	ProviderGCPKMS    Provider = "gcp"       // Google Cloud KMS
	ProviderVault     Provider = "vault"     // HashiCorp Vault
	ProviderAzureKMS  Provider = "azure"     // Azure Key Vault
)

// Config holds KMS configuration
type Config struct {
	Provider Provider

	// Local provider config (development only)
	LocalPrivateKey string

	// AWS KMS config
	AWSRegion string
	AWSKeyID  string

	// GCP KMS config
	GCPProjectID   string
	GCPLocationID  string
	GCPKeyRingID   string
	GCPKeyID       string
	GCPKeyVersion  string

	// HashiCorp Vault config
	VaultAddress   string
	VaultToken     string
	VaultMountPath string
	VaultKeyName   string

	// Azure Key Vault config
	AzureVaultURL string
	AzureKeyName  string
}

// NewSigner creates a new signer based on the provider configuration
func NewSigner(ctx context.Context, cfg *Config) (Signer, error) {
	switch cfg.Provider {
	case ProviderLocal:
		return NewLocalSigner(cfg.LocalPrivateKey)
	case ProviderAWSKMS:
		return NewAWSKMSSigner(ctx, cfg)
	case ProviderGCPKMS:
		return NewGCPKMSSigner(ctx, cfg)
	case ProviderVault:
		return NewVaultSigner(ctx, cfg)
	default:
		return nil, fmt.Errorf("unsupported KMS provider: %s", cfg.Provider)
	}
}

// recoverPublicKey recovers the public key from a signature
func recoverPublicKey(hash []byte, sig []byte) (*ecdsa.PublicKey, error) {
	// The signature format from KMS providers is typically (r, s, v)
	// We need to recover the public key for verification
	if len(sig) < 64 {
		return nil, fmt.Errorf("signature too short: %d bytes", len(sig))
	}
	return nil, fmt.Errorf("public key recovery not implemented for KMS signatures")
}
