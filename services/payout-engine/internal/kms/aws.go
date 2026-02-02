package kms

import (
	"context"
	"crypto/ecdsa"
	"encoding/asn1"
	"fmt"
	"math/big"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	kmsTypes "github.com/aws/aws-sdk-go-v2/service/kms/types"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// AWSKMSSigner implements Signer using AWS KMS
type AWSKMSSigner struct {
	client    *kms.Client
	keyID     string
	publicKey *ecdsa.PublicKey
	address   common.Address
}

// NewAWSKMSSigner creates a new AWSKMSSigner
func NewAWSKMSSigner(ctx context.Context, cfg *Config) (*AWSKMSSigner, error) {
	// Load AWS config
	awsCfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := kms.NewFromConfig(awsCfg)

	// Get public key from KMS
	pubKeyOutput, err := client.GetPublicKey(ctx, &kms.GetPublicKeyInput{
		KeyId: &cfg.AWSKeyID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get public key from KMS: %w", err)
	}

	// Parse the public key (DER encoded)
	publicKey, err := parseECDSAPublicKey(pubKeyOutput.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	address := crypto.PubkeyToAddress(*publicKey)

	return &AWSKMSSigner{
		client:    client,
		keyID:     cfg.AWSKeyID,
		publicKey: publicKey,
		address:   address,
	}, nil
}

// GetAddress returns the Ethereum address associated with this signer
func (s *AWSKMSSigner) GetAddress(ctx context.Context) (common.Address, error) {
	return s.address, nil
}

// SignTransaction signs a transaction using AWS KMS
func (s *AWSKMSSigner) SignTransaction(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error) {
	signer := types.LatestSignerForChainID(chainID)
	hash := signer.Hash(tx).Bytes()

	// Sign the hash using KMS
	sig, err := s.signHashWithKMS(ctx, hash)
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

// SignHash signs a hash using AWS KMS
func (s *AWSKMSSigner) SignHash(ctx context.Context, hash []byte) ([]byte, error) {
	return s.signHashWithKMS(ctx, hash)
}

// signHashWithKMS performs the actual KMS signing
func (s *AWSKMSSigner) signHashWithKMS(ctx context.Context, hash []byte) ([]byte, error) {
	// Sign using KMS
	signOutput, err := s.client.Sign(ctx, &kms.SignInput{
		KeyId:            &s.keyID,
		Message:          hash,
		MessageType:      kmsTypes.MessageTypeDigest,
		SigningAlgorithm: kmsTypes.SigningAlgorithmSpecEcdsaSha256,
	})
	if err != nil {
		return nil, fmt.Errorf("KMS signing failed: %w", err)
	}

	// Parse DER signature to (r, s)
	r, sVal, err := parseDERSignature(signOutput.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to parse signature: %w", err)
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

	// Pad r and s to 32 bytes
	copy(sig[32-len(rBytes):32], rBytes)
	copy(sig[64-len(sBytes):64], sBytes)
	sig[64] = byte(v)

	return sig, nil
}

// calculateRecoveryID determines the recovery ID for the signature
func (s *AWSKMSSigner) calculateRecoveryID(hash []byte, r, sVal *big.Int) (int, error) {
	// Normalize s to lower half of curve order
	halfOrder := new(big.Int).Rsh(crypto.S256().Params().N, 1)
	if sVal.Cmp(halfOrder) > 0 {
		sVal = new(big.Int).Sub(crypto.S256().Params().N, sVal)
	}

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
func (s *AWSKMSSigner) Close() error {
	return nil
}

// parseDERSignature parses a DER-encoded ECDSA signature
func parseDERSignature(der []byte) (*big.Int, *big.Int, error) {
	var sig struct {
		R, S *big.Int
	}
	_, err := asn1.Unmarshal(der, &sig)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal DER signature: %w", err)
	}
	return sig.R, sig.S, nil
}

// parseECDSAPublicKey parses a DER-encoded ECDSA public key
func parseECDSAPublicKey(der []byte) (*ecdsa.PublicKey, error) {
	pub, err := crypto.UnmarshalPubkey(der)
	if err != nil {
		// Try parsing as SubjectPublicKeyInfo
		return parseSubjectPublicKeyInfo(der)
	}
	return pub, nil
}

// parseSubjectPublicKeyInfo parses a SubjectPublicKeyInfo structure
func parseSubjectPublicKeyInfo(der []byte) (*ecdsa.PublicKey, error) {
	type publicKeyInfo struct {
		Raw       asn1.RawContent
		Algorithm struct {
			Algorithm  asn1.ObjectIdentifier
			Parameters asn1.RawValue
		}
		PublicKey asn1.BitString
	}

	var info publicKeyInfo
	_, err := asn1.Unmarshal(der, &info)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SubjectPublicKeyInfo: %w", err)
	}

	pubKeyBytes := info.PublicKey.Bytes
	if len(pubKeyBytes) == 0 {
		return nil, fmt.Errorf("empty public key")
	}

	// Uncompressed public key format: 0x04 + X + Y (65 bytes)
	pub, err := crypto.UnmarshalPubkey(pubKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal public key: %w", err)
	}

	return pub, nil
}
