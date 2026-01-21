package protocolbanks

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"
)

// ============================================================================
// Constants
// ============================================================================

const (
	// DefaultValiditySeconds is the default x402 authorization validity (1 hour).
	DefaultValiditySeconds = 3600

	// MaxValiditySeconds is the maximum x402 authorization validity (24 hours).
	MaxValiditySeconds = 86400
)

// TransferWithAuthorizationTypes is the EIP-712 type definition.
var TransferWithAuthorizationTypes = EIP712Types{
	"TransferWithAuthorization": {
		{Name: "from", Type: "address"},
		{Name: "to", Type: "address"},
		{Name: "value", Type: "uint256"},
		{Name: "validAfter", Type: "uint256"},
		{Name: "validBefore", Type: "uint256"},
		{Name: "nonce", Type: "bytes32"},
	},
}

// ============================================================================
// X402 Module
// ============================================================================

// X402Module handles x402 gasless payment authorizations.
type X402Module struct {
	http           *HTTPClient
	authorizations sync.Map // map[string]*X402Authorization
}

// NewX402Module creates a new X402Module.
func NewX402Module(http *HTTPClient) *X402Module {
	return &X402Module{
		http: http,
	}
}

// CreateAuthorization creates an EIP-712 authorization for signing.
func (m *X402Module) CreateAuthorization(ctx context.Context, params X402AuthorizationParams) (*X402Authorization, error) {
	// Validate parameters
	if err := m.validateParams(&params); err != nil {
		return nil, err
	}

	// Check chain support
	if !m.IsChainSupported(params.ChainID) {
		return nil, NewSDKError(ErrX402UnsupportedChain, ErrorCategoryX402,
			fmt.Sprintf("Chain %d does not support x402 gasless payments", params.ChainID))
	}

	// Check token support
	if !m.IsTokenSupported(params.ChainID, params.Token) {
		return nil, NewSDKError(ErrX402UnsupportedToken, ErrorCategoryX402,
			fmt.Sprintf("Token %s does not support x402 on chain %d", params.Token, params.ChainID))
	}

	// Calculate timestamps
	now := time.Now().Unix()
	validFor := params.ValidFor
	if validFor == 0 {
		validFor = DefaultValiditySeconds
	}
	if validFor > MaxValiditySeconds {
		validFor = MaxValiditySeconds
	}

	validAfter := now
	validBefore := now + int64(validFor)

	// Generate unique nonce
	nonce := GenerateNonce()

	// Get token contract address
	tokenAddress := m.getTokenAddress(params.ChainID, params.Token)

	// Build EIP-712 domain
	domain := EIP712Domain{
		Name:              m.getTokenName(params.Token),
		Version:           "2", // USDC uses version 2
		ChainID:           params.ChainID,
		VerifyingContract: tokenAddress,
	}

	// Parse amount to wei
	decimals := TokenDecimals(NumericChainID(params.ChainID), params.Token)
	value := m.parseAmount(params.Amount, decimals)

	// Build message
	message := TransferWithAuthorizationMessage{
		From:        "", // Will be filled by signer
		To:          params.To,
		Value:       value,
		ValidAfter:  validAfter,
		ValidBefore: validBefore,
		Nonce:       nonce,
	}

	// Generate authorization ID
	id := GenerateX402ID()

	// Create authorization object
	auth := &X402Authorization{
		ID:        id,
		Domain:    domain,
		Types:     TransferWithAuthorizationTypes,
		Message:   message,
		Status:    X402StatusPending,
		CreatedAt: time.Now(),
		ExpiresAt: time.Unix(validBefore, 0),
	}

	// Store locally
	m.authorizations.Store(id, auth)

	// Register with backend (optional, non-blocking)
	go func() {
		_ = m.http.Post(context.Background(), "/x402/authorizations", map[string]interface{}{
			"id":          id,
			"chainId":     params.ChainID,
			"token":       params.Token,
			"to":          params.To,
			"amount":      params.Amount,
			"validBefore": validBefore,
			"nonce":       nonce,
		}, nil)
	}()

	return auth, nil
}

// SubmitSignature submits a signed authorization to the relayer.
func (m *X402Module) SubmitSignature(ctx context.Context, authID, signature string) (*X402Authorization, error) {
	auth, ok := m.authorizations.Load(authID)
	if !ok {
		return nil, NewSDKError(ErrX402AuthorizationExpired, ErrorCategoryX402,
			"Authorization not found or expired")
	}

	authorization := auth.(*X402Authorization)

	// Check if expired
	if m.isExpired(authorization) {
		authorization.Status = X402StatusExpired
		return nil, NewSDKError(ErrX402AuthorizationExpired, ErrorCategoryX402,
			"Authorization has expired")
	}

	// Validate signature format
	if !m.isValidSignature(signature) {
		return nil, NewSDKError(ErrX402InvalidSignature, ErrorCategoryX402,
			"Invalid signature format")
	}

	// Update status
	authorization.Status = X402StatusSigned
	authorization.Signature = signature

	// Submit to relayer
	var response struct {
		TransactionHash string     `json:"transactionHash"`
		Status          X402Status `json:"status"`
	}

	err := m.http.Post(ctx, "/x402/submit", map[string]interface{}{
		"authorizationId": authID,
		"signature":       signature,
		"domain":          authorization.Domain,
		"message":         authorization.Message,
	}, &response)

	if err != nil {
		authorization.Status = X402StatusFailed
		return nil, err
	}

	authorization.Status = response.Status
	authorization.TransactionHash = response.TransactionHash

	return authorization, nil
}

// GetStatus gets the status of an authorization.
func (m *X402Module) GetStatus(ctx context.Context, authID string) (*X402Authorization, error) {
	// Check local cache first
	if auth, ok := m.authorizations.Load(authID); ok {
		authorization := auth.(*X402Authorization)

		// Check if expired
		if m.isExpired(authorization) && authorization.Status == X402StatusPending {
			authorization.Status = X402StatusExpired
		}

		// If not final status, fetch from backend
		if !m.isFinalStatus(authorization.Status) {
			var response X402Authorization
			if err := m.http.Get(ctx, "/x402/authorizations/"+authID, &response); err == nil {
				authorization.Status = response.Status
				if response.TransactionHash != "" {
					authorization.TransactionHash = response.TransactionHash
				}
			}
		}

		return authorization, nil
	}

	// Fetch from backend
	var response X402Authorization
	if err := m.http.Get(ctx, "/x402/authorizations/"+authID, &response); err != nil {
		return nil, err
	}

	// Cache locally
	m.authorizations.Store(authID, &response)

	return &response, nil
}

// Cancel cancels a pending authorization.
func (m *X402Module) Cancel(ctx context.Context, authID string) error {
	auth, ok := m.authorizations.Load(authID)
	if !ok {
		return NewSDKError(ErrX402AuthorizationExpired, ErrorCategoryX402,
			"Authorization not found")
	}

	authorization := auth.(*X402Authorization)

	// Can only cancel pending authorizations
	if authorization.Status != X402StatusPending && authorization.Status != X402StatusSigned {
		return NewSDKError(ErrX402AuthorizationExpired, ErrorCategoryX402,
			fmt.Sprintf("Cannot cancel authorization in %s status", authorization.Status))
	}

	// Update status
	authorization.Status = X402StatusCancelled

	// Notify backend
	_ = m.http.Post(ctx, "/x402/authorizations/"+authID+"/cancel", nil, nil)

	return nil
}

// IsChainSupported checks if a chain supports x402.
func (m *X402Module) IsChainSupported(chainID int) bool {
	for _, c := range X402SupportedChains() {
		if int(c) == chainID {
			return true
		}
	}
	return false
}

// IsTokenSupported checks if a token supports x402 on a chain.
func (m *X402Module) IsTokenSupported(chainID int, token TokenSymbol) bool {
	if !m.IsChainSupported(chainID) {
		return false
	}

	for _, t := range X402SupportedTokens() {
		if t == token {
			return true
		}
	}
	return false
}

// GetSupportedChains returns chains that support x402.
func (m *X402Module) GetSupportedChains() []int {
	chains := X402SupportedChains()
	result := make([]int, len(chains))
	for i, c := range chains {
		result[i] = int(c)
	}
	return result
}

// GetSupportedTokens returns tokens that support x402 on a chain.
func (m *X402Module) GetSupportedTokens(chainID int) []TokenSymbol {
	if !m.IsChainSupported(chainID) {
		return nil
	}

	var tokens []TokenSymbol
	for _, t := range X402SupportedTokens() {
		if m.IsTokenSupported(chainID, t) {
			tokens = append(tokens, t)
		}
	}
	return tokens
}

// GetTypedData returns the EIP-712 typed data for signing.
func (m *X402Module) GetTypedData(auth *X402Authorization, fromAddress string) map[string]interface{} {
	message := auth.Message
	message.From = fromAddress

	return map[string]interface{}{
		"domain":      auth.Domain,
		"types":       auth.Types,
		"primaryType": "TransferWithAuthorization",
		"message":     message,
	}
}

// GetPendingAuthorizations returns all pending authorizations.
func (m *X402Module) GetPendingAuthorizations() []*X402Authorization {
	var pending []*X402Authorization
	m.authorizations.Range(func(key, value interface{}) bool {
		auth := value.(*X402Authorization)
		if auth.Status == X402StatusPending || auth.Status == X402StatusSigned {
			pending = append(pending, auth)
		}
		return true
	})
	return pending
}

// CleanupExpired removes expired authorizations.
func (m *X402Module) CleanupExpired() int {
	var cleaned int
	m.authorizations.Range(func(key, value interface{}) bool {
		auth := value.(*X402Authorization)
		if m.isExpired(auth) {
			if auth.Status == X402StatusPending {
				auth.Status = X402StatusExpired
			}
			m.authorizations.Delete(key)
			cleaned++
		}
		return true
	})
	return cleaned
}

// ============================================================================
// Private Methods
// ============================================================================

func (m *X402Module) validateParams(params *X402AuthorizationParams) error {
	if err := ValidateAddress(params.To, NumericChainID(params.ChainID)); err != nil {
		return err
	}

	if err := ValidateAmount(params.Amount); err != nil {
		return err
	}

	if err := ValidateToken(params.Token); err != nil {
		return err
	}

	if params.ValidFor != 0 {
		if params.ValidFor < 60 || params.ValidFor > MaxValiditySeconds {
			return NewSDKError(ErrValidOutOfRange, ErrorCategoryValid,
				fmt.Sprintf("validFor must be between 60 and %d seconds", MaxValiditySeconds))
		}
	}

	return nil
}

func (m *X402Module) getTokenAddress(chainID int, token TokenSymbol) string {
	if token == TokenUSDC {
		if addr, ok := USDCAddresses[NumericChainID(chainID)]; ok {
			return addr
		}
	}
	return ""
}

func (m *X402Module) getTokenName(token TokenSymbol) string {
	names := map[TokenSymbol]string{
		TokenUSDC:  "USD Coin",
		TokenUSDT:  "Tether USD",
		TokenDAI:   "Dai Stablecoin",
		TokenETH:   "Ethereum",
		TokenMATIC: "Polygon",
		TokenBNB:   "BNB",
		TokenSOL:   "Solana",
		TokenBTC:   "Bitcoin",
	}
	if name, ok := names[token]; ok {
		return name
	}
	return string(token)
}

func (m *X402Module) parseAmount(amount string, decimals int) string {
	// Parse amount and convert to smallest unit
	f := new(big.Float)
	f.SetString(amount)

	// Multiply by 10^decimals
	multiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	f.Mul(f, multiplier)

	// Convert to integer
	result := new(big.Int)
	f.Int(result)

	return result.String()
}

func (m *X402Module) isExpired(auth *X402Authorization) bool {
	return time.Now().After(auth.ExpiresAt)
}

func (m *X402Module) isFinalStatus(status X402Status) bool {
	return status == X402StatusExecuted ||
		status == X402StatusFailed ||
		status == X402StatusExpired ||
		status == X402StatusCancelled
}

func (m *X402Module) isValidSignature(signature string) bool {
	// EIP-712 signature should be 65 bytes (130 hex chars + 0x prefix)
	if len(signature) != 132 {
		return false
	}
	if signature[:2] != "0x" {
		return false
	}
	for _, c := range signature[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
