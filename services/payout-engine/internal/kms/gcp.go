package kms

import (
	"context"
	"crypto/ecdsa"
	"encoding/asn1"
	"fmt"
	"hash/crc32"
	"math/big"

	kmsapi "cloud.google.com/go/kms/apiv1"
	"cloud.google.com/go/kms/apiv1/kmspb"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

// GCPKMSSigner implements Signer using Google Cloud KMS
type GCPKMSSigner struct {
	client    *kmsapi.KeyManagementClient
	keyPath   string
	publicKey *ecdsa.PublicKey
	address   common.Address
}

// NewGCPKMSSigner creates a new GCPKMSSigner
func NewGCPKMSSigner(ctx context.Context, cfg *Config) (*GCPKMSSigner, error) {
	client, err := kmsapi.NewKeyManagementClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create KMS client: %w", err)
	}

	// Construct the key version path
	keyPath := fmt.Sprintf(
		"projects/%s/locations/%s/keyRings/%s/cryptoKeys/%s/cryptoKeyVersions/%s",
		cfg.GCPProjectID,
		cfg.GCPLocationID,
		cfg.GCPKeyRingID,
		cfg.GCPKeyID,
		cfg.GCPKeyVersion,
	)

	// Get public key from GCP KMS
	pubKeyResp, err := client.GetPublicKey(ctx, &kmspb.GetPublicKeyRequest{
		Name: keyPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get public key from GCP KMS: %w", err)
	}

	// Parse PEM public key
	publicKey, err := parseGCPPublicKey(pubKeyResp.Pem)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	address := crypto.PubkeyToAddress(*publicKey)

	return &GCPKMSSigner{
		client:    client,
		keyPath:   keyPath,
		publicKey: publicKey,
		address:   address,
	}, nil
}

// GetAddress returns the Ethereum address associated with this signer
func (s *GCPKMSSigner) GetAddress(ctx context.Context) (common.Address, error) {
	return s.address, nil
}

// SignTransaction signs a transaction using GCP KMS
func (s *GCPKMSSigner) SignTransaction(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error) {
	signer := types.LatestSignerForChainID(chainID)
	hash := signer.Hash(tx).Bytes()

	// Sign the hash using GCP KMS
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

// SignHash signs a hash using GCP KMS
func (s *GCPKMSSigner) SignHash(ctx context.Context, hash []byte) ([]byte, error) {
	return s.signHashWithKMS(ctx, hash)
}

// signHashWithKMS performs the actual GCP KMS signing
func (s *GCPKMSSigner) signHashWithKMS(ctx context.Context, hash []byte) ([]byte, error) {
	// Calculate CRC32C checksum for data integrity
	crc32c := func(data []byte) uint32 {
		t := crc32.MakeTable(crc32.Castagnoli)
		return crc32.Checksum(data, t)
	}
	digestCRC32C := crc32c(hash)

	// Sign using GCP KMS
	signResp, err := s.client.AsymmetricSign(ctx, &kmspb.AsymmetricSignRequest{
		Name: s.keyPath,
		Digest: &kmspb.Digest{
			Digest: &kmspb.Digest_Sha256{
				Sha256: hash,
			},
		},
		DigestCrc32C: wrapperspb.Int64(int64(digestCRC32C)),
	})
	if err != nil {
		return nil, fmt.Errorf("GCP KMS signing failed: %w", err)
	}

	// Verify signature checksum
	if !signResp.VerifiedDigestCrc32C {
		return nil, fmt.Errorf("digest checksum verification failed")
	}

	expectedSigCRC32C := crc32c(signResp.Signature)
	if int64(expectedSigCRC32C) != signResp.SignatureCrc32C.Value {
		return nil, fmt.Errorf("signature checksum mismatch")
	}

	// Parse DER signature to (r, s)
	r, sVal, err := parseDERSignature(signResp.Signature)
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
func (s *GCPKMSSigner) calculateRecoveryID(hash []byte, r, sVal *big.Int) (int, error) {
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
func (s *GCPKMSSigner) Close() error {
	return s.client.Close()
}

// parseGCPPublicKey parses a PEM-encoded public key from GCP KMS
func parseGCPPublicKey(pem string) (*ecdsa.PublicKey, error) {
	// GCP returns public key in PEM format
	// We need to parse the ASN.1 DER encoded public key
	block := []byte(pem)

	// Find the base64 encoded key between headers
	var derBytes []byte
	inKey := false
	for _, line := range splitLines(string(block)) {
		if line == "-----BEGIN PUBLIC KEY-----" {
			inKey = true
			continue
		}
		if line == "-----END PUBLIC KEY-----" {
			break
		}
		if inKey {
			decoded, err := base64Decode(line)
			if err == nil {
				derBytes = append(derBytes, decoded...)
			}
		}
	}

	if len(derBytes) == 0 {
		return nil, fmt.Errorf("failed to extract public key from PEM")
	}

	return parseSubjectPublicKeyInfo(derBytes)
}

// splitLines splits a string into lines
func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			line := s[start:i]
			if len(line) > 0 && line[len(line)-1] == '\r' {
				line = line[:len(line)-1]
			}
			lines = append(lines, line)
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

// base64Decode decodes a base64 string
func base64Decode(s string) ([]byte, error) {
	// Standard base64 alphabet
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

	// Remove whitespace
	clean := ""
	for _, c := range s {
		if c != ' ' && c != '\t' && c != '\n' && c != '\r' {
			clean += string(c)
		}
	}

	// Decode
	result := make([]byte, 0, len(clean)*3/4)
	buf := 0
	nbits := 0

	for _, c := range clean {
		if c == '=' {
			break
		}

		idx := -1
		for i, a := range alphabet {
			if a == c {
				idx = i
				break
			}
		}
		if idx < 0 {
			return nil, fmt.Errorf("invalid base64 character: %c", c)
		}

		buf = (buf << 6) | idx
		nbits += 6

		if nbits >= 8 {
			nbits -= 8
			result = append(result, byte(buf>>nbits))
			buf &= (1 << nbits) - 1
		}
	}

	return result, nil
}
