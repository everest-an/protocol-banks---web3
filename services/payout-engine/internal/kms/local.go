package kms

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// LocalSigner implements Signer using a local private key
// WARNING: This should ONLY be used for development/testing
type LocalSigner struct {
	privateKey *ecdsa.PrivateKey
	address    common.Address
}

// NewLocalSigner creates a new LocalSigner from a hex-encoded private key
func NewLocalSigner(privateKeyHex string) (*LocalSigner, error) {
	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	if privateKeyHex == "" {
		return nil, fmt.Errorf("private key is required")
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("failed to get public key")
	}

	address := crypto.PubkeyToAddress(*publicKeyECDSA)

	return &LocalSigner{
		privateKey: privateKey,
		address:    address,
	}, nil
}

// GetAddress returns the Ethereum address associated with this signer
func (s *LocalSigner) GetAddress(ctx context.Context) (common.Address, error) {
	return s.address, nil
}

// SignTransaction signs a transaction with the local private key
func (s *LocalSigner) SignTransaction(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error) {
	signer := types.LatestSignerForChainID(chainID)
	signedTx, err := types.SignTx(tx, signer, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}
	return signedTx, nil
}

// SignHash signs a hash with the local private key
func (s *LocalSigner) SignHash(ctx context.Context, hash []byte) ([]byte, error) {
	sig, err := crypto.Sign(hash, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign hash: %w", err)
	}
	return sig, nil
}

// Close releases any resources held by the signer
func (s *LocalSigner) Close() error {
	// Zero out the private key for security
	s.privateKey = nil
	return nil
}
