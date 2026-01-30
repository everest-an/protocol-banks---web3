package kms

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	vault "github.com/hashicorp/vault/api"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// VaultSigner implements Signer using HashiCorp Vault Transit secrets engine
type VaultSigner struct {
	client    *vault.Client
	mountPath string
	keyName   string
	publicKey *ecdsa.PublicKey
	address   common.Address
}

// NewVaultSigner creates a new VaultSigner
func NewVaultSigner(ctx context.Context, cfg *Config) (*VaultSigner, error) {
	// Create Vault client
	vaultCfg := vault.DefaultConfig()
	vaultCfg.Address = cfg.VaultAddress

	client, err := vault.NewClient(vaultCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Vault client: %w", err)
	}

	// Set token
	client.SetToken(cfg.VaultToken)

	mountPath := cfg.VaultMountPath
	if mountPath == "" {
		mountPath = "transit"
	}

	signer := &VaultSigner{
		client:    client,
		mountPath: mountPath,
		keyName:   cfg.VaultKeyName,
	}

	// Get public key from Vault
	publicKey, err := signer.getPublicKey(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get public key from Vault: %w", err)
	}

	signer.publicKey = publicKey
	signer.address = crypto.PubkeyToAddress(*publicKey)

	return signer, nil
}

// getPublicKey retrieves the public key from Vault
func (s *VaultSigner) getPublicKey(ctx context.Context) (*ecdsa.PublicKey, error) {
	// Read key info from Vault
	path := fmt.Sprintf("%s/keys/%s", s.mountPath, s.keyName)
	secret, err := s.client.Logical().ReadWithContext(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to read key from Vault: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("key not found in Vault")
	}

	// Extract public key from response
	keys, ok := secret.Data["keys"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid key data format")
	}

	// Get the latest key version
	var latestVersion string
	var latestKey map[string]interface{}
	for version, keyData := range keys {
		if latestVersion == "" || version > latestVersion {
			latestVersion = version
			latestKey, _ = keyData.(map[string]interface{})
		}
	}

	if latestKey == nil {
		return nil, fmt.Errorf("no key versions found")
	}

	// Extract public key hex
	pubKeyHex, ok := latestKey["public_key"].(string)
	if !ok {
		return nil, fmt.Errorf("public key not found in key data")
	}

	// Remove 0x prefix if present
	pubKeyHex = strings.TrimPrefix(pubKeyHex, "0x")

	pubKeyBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode public key hex: %w", err)
	}

	publicKey, err := crypto.UnmarshalPubkey(pubKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal public key: %w", err)
	}

	return publicKey, nil
}

// GetAddress returns the Ethereum address associated with this signer
func (s *VaultSigner) GetAddress(ctx context.Context) (common.Address, error) {
	return s.address, nil
}

// SignTransaction signs a transaction using HashiCorp Vault
func (s *VaultSigner) SignTransaction(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error) {
	signer := types.LatestSignerForChainID(chainID)
	hash := signer.Hash(tx).Bytes()

	// Sign the hash using Vault
	sig, err := s.signHashWithVault(ctx, hash)
	if err != nil {
		return nil, err
	}

	// Create signed transaction
	signedTx, err := tx.WithSignature(signer, sig)
	if err != nil {
		return nil, fmt.Errorf("failed to apply signature: %w", err)
	}

	return signedTx, nil
}

// SignHash signs a hash using HashiCorp Vault
func (s *VaultSigner) SignHash(ctx context.Context, hash []byte) ([]byte, error) {
	return s.signHashWithVault(ctx, hash)
}

// signHashWithVault performs the actual Vault signing
func (s *VaultSigner) signHashWithVault(ctx context.Context, hash []byte) ([]byte, error) {
	// Encode hash as base64
	hashHex := hex.EncodeToString(hash)

	// Sign using Vault Transit
	path := fmt.Sprintf("%s/sign/%s", s.mountPath, s.keyName)
	data := map[string]interface{}{
		"input":               hashHex,
		"prehashed":           true,
		"signature_algorithm": "ecdsa",
	}

	secret, err := s.client.Logical().WriteWithContext(ctx, path, data)
	if err != nil {
		return nil, fmt.Errorf("Vault signing failed: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("empty response from Vault")
	}

	// Extract signature
	sigString, ok := secret.Data["signature"].(string)
	if !ok {
		return nil, fmt.Errorf("signature not found in response")
	}

	// Parse the signature (format: vault:v1:base64_signature)
	parts := strings.Split(sigString, ":")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid signature format")
	}

	sigBase64 := parts[len(parts)-1]
	sigBytes, err := base64Decode(sigBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode signature: %w", err)
	}

	// Parse DER signature to (r, s)
	r, sVal, err := parseDERSignature(sigBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse signature: %w", err)
	}

	// Normalize s to lower half of curve order
	halfOrder := new(big.Int).Rsh(crypto.S256().Params().N, 1)
	if sVal.Cmp(halfOrder) > 0 {
		sVal = new(big.Int).Sub(crypto.S256().Params().N, sVal)
	}

	// Calculate recovery ID (v)
	v, err := s.calculateRecoveryID(hash, r, sVal)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate recovery ID: %w", err)
	}

	// Construct Ethereum signature: r (32 bytes) + s (32 bytes) + v (1 byte)
	sig := make([]byte, 65)
	rBytes := r.Bytes()
	sBytes := sVal.Bytes()

	copy(sig[32-len(rBytes):32], rBytes)
	copy(sig[64-len(sBytes):64], sBytes)
	sig[64] = byte(v)

	return sig, nil
}

// calculateRecoveryID determines the recovery ID for the signature
func (s *VaultSigner) calculateRecoveryID(hash []byte, r, sVal *big.Int) (int, error) {
	// Try both recovery IDs (0 and 1)
	for v := 0; v <= 1; v++ {
		sig := make([]byte, 65)
		rBytes := r.Bytes()
		sBytes := sVal.Bytes()

		copy(sig[32-len(rBytes):32], rBytes)
		copy(sig[64-len(sBytes):64], sBytes)
		sig[64] = byte(v)

		// Recover public key
		recoveredPub, err := crypto.SigToPub(hash, sig)
		if err != nil {
			continue
		}

		// Check if recovered address matches
		if crypto.PubkeyToAddress(*recoveredPub) == s.address {
			return v, nil
		}
	}

	return 0, fmt.Errorf("could not determine recovery ID")
}

// Close releases any resources held by the signer
func (s *VaultSigner) Close() error {
	return nil
}
