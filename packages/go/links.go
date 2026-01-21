package protocolbanks

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ============================================================================
// Payment Link Module
// ============================================================================

// PaymentLinkModule handles payment link generation, verification, and parsing.
type PaymentLinkModule struct {
	apiSecret string
	baseURL   string
}

// NewPaymentLinkModule creates a new PaymentLinkModule.
func NewPaymentLinkModule(apiSecret string, baseURL string) *PaymentLinkModule {
	if baseURL == "" {
		baseURL = PaymentLinkBaseURL
	}
	return &PaymentLinkModule{
		apiSecret: apiSecret,
		baseURL:   baseURL,
	}
}

// Generate creates a signed payment link.
func (m *PaymentLinkModule) Generate(params PaymentLinkParams) (*PaymentLink, error) {
	// Validate parameters
	if err := m.validateParams(&params); err != nil {
		return nil, err
	}

	// Set defaults
	token := params.Token
	if token == "" {
		token = DefaultToken
	}

	expiryHours := params.ExpiryHours
	if expiryHours == 0 {
		expiryHours = DefaultExpiryHours
	}

	// Calculate expiry timestamp
	now := time.Now()
	expiresAt := now.Add(time.Duration(expiryHours) * time.Hour)
	expiryMs := expiresAt.UnixMilli()

	// Generate payment ID
	paymentID := GeneratePaymentID()

	// Generate signature
	signature := GeneratePaymentLinkSignature(PaymentLinkSignatureParams{
		To:     params.To,
		Amount: params.Amount,
		Token:  string(token),
		Expiry: expiryMs,
		Memo:   params.Memo,
	}, m.apiSecret)

	// Build URL
	linkURL := m.buildURL(&params, token, expiryMs, signature, paymentID)

	// Build short URL (placeholder)
	shortURL := strings.Replace(m.baseURL, "/pay", "", 1) + "/p/" + paymentID[4:12]

	return &PaymentLink{
		URL:       linkURL,
		ShortURL:  shortURL,
		Params:    params,
		Signature: signature,
		ExpiresAt: expiresAt,
		CreatedAt: now,
		PaymentID: paymentID,
	}, nil
}

// Verify verifies a payment link's integrity and expiry.
func (m *PaymentLinkModule) Verify(linkURL string) *LinkVerificationResult {
	// Parse URL
	parsed, err := m.parseURL(linkURL)
	if err != nil {
		return &LinkVerificationResult{
			Valid:          false,
			Expired:        false,
			TamperedFields: []string{},
			Error:          "Invalid payment link URL format",
		}
	}

	params, signature, expiry := parsed.params, parsed.signature, parsed.expiry

	// Check for homoglyphs
	if homoglyphDetails := DetectHomoglyphs(params.To); homoglyphDetails != nil {
		return &LinkVerificationResult{
			Valid:             false,
			Expired:           false,
			TamperedFields:    []string{"to"},
			Params:            params,
			Error:             "Homoglyph attack detected in address",
			HomoglyphDetected: true,
			HomoglyphDetails:  homoglyphDetails,
		}
	}

	// Check expiry
	expired := IsExpired(expiry)

	// Verify signature
	token := params.Token
	if token == "" {
		token = DefaultToken
	}

	expectedSignature := GeneratePaymentLinkSignature(PaymentLinkSignatureParams{
		To:     params.To,
		Amount: params.Amount,
		Token:  string(token),
		Expiry: expiry,
		Memo:   params.Memo,
	}, m.apiSecret)

	signatureValid := ConstantTimeEqual(signature, expectedSignature)

	// Detect tampered fields
	var tamperedFields []string
	if !signatureValid {
		tamperedFields = append(tamperedFields, "signature")
	}

	var errMsg string
	if expired {
		errMsg = "Payment link has expired"
	} else if !signatureValid {
		errMsg = "Payment link signature is invalid"
	}

	return &LinkVerificationResult{
		Valid:          signatureValid && !expired,
		Expired:        expired,
		TamperedFields: tamperedFields,
		Params:         params,
		Error:          errMsg,
	}
}

// Parse extracts parameters from a payment link URL.
func (m *PaymentLinkModule) Parse(linkURL string) (*PaymentLinkParams, error) {
	parsed, err := m.parseURL(linkURL)
	if err != nil {
		return nil, err
	}
	return parsed.params, nil
}

// GetSupportedChains returns chains that support a token.
func (m *PaymentLinkModule) GetSupportedChains(token TokenSymbol) []ChainID {
	return ChainsForToken(token)
}

// GetSupportedTokens returns tokens supported on a chain.
func (m *PaymentLinkModule) GetSupportedTokens(chain ChainID) []TokenSymbol {
	return TokensForChain(chain)
}

// ============================================================================
// Private Methods
// ============================================================================

func (m *PaymentLinkModule) validateParams(params *PaymentLinkParams) error {
	// Validate recipient address
	if err := ValidateAddress(params.To, params.Chain); err != nil {
		return err
	}

	// Validate amount
	if err := ValidateAmount(params.Amount); err != nil {
		return err
	}

	// Validate token if provided
	if params.Token != "" {
		if err := ValidateToken(params.Token); err != nil {
			return err
		}
	}

	// Validate chain if provided
	if params.Chain != nil {
		if err := ValidateChainID(params.Chain); err != nil {
			return err
		}
	}

	// Validate expiry hours if provided
	if params.ExpiryHours != 0 {
		if err := ValidateExpiryHours(params.ExpiryHours); err != nil {
			return err
		}
	}

	// Validate memo if provided
	if params.Memo != "" {
		if err := ValidateMemo(params.Memo); err != nil {
			return err
		}
	}

	// Validate allowed chains
	for _, chain := range params.AllowedChains {
		if err := ValidateChainID(chain); err != nil {
			return err
		}
	}

	// Validate allowed tokens
	for _, token := range params.AllowedTokens {
		if err := ValidateToken(token); err != nil {
			return err
		}
	}

	return nil
}

func (m *PaymentLinkModule) buildURL(params *PaymentLinkParams, token TokenSymbol, expiry int64, signature, paymentID string) string {
	u, _ := url.Parse(m.baseURL)
	q := u.Query()

	// Required params
	q.Set("to", params.To)
	q.Set("amount", params.Amount)
	q.Set("token", string(token))
	q.Set("exp", strconv.FormatInt(expiry, 10))
	q.Set("sig", signature)
	q.Set("id", paymentID)

	// Optional params
	if params.Chain != nil {
		q.Set("chain", fmt.Sprintf("%v", params.Chain))
	}
	if params.Memo != "" {
		q.Set("memo", params.Memo)
	}
	if params.OrderID != "" {
		q.Set("orderId", params.OrderID)
	}
	if params.CallbackURL != "" {
		q.Set("callback", params.CallbackURL)
	}
	if len(params.AllowedChains) > 0 {
		var chains []string
		for _, c := range params.AllowedChains {
			chains = append(chains, fmt.Sprintf("%v", c))
		}
		q.Set("chains", strings.Join(chains, ","))
	}
	if len(params.AllowedTokens) > 0 {
		var tokens []string
		for _, t := range params.AllowedTokens {
			tokens = append(tokens, string(t))
		}
		q.Set("tokens", strings.Join(tokens, ","))
	}

	u.RawQuery = q.Encode()
	return u.String()
}

type parsedURL struct {
	params    *PaymentLinkParams
	signature string
	expiry    int64
}

func (m *PaymentLinkModule) parseURL(linkURL string) (*parsedURL, error) {
	u, err := url.Parse(linkURL)
	if err != nil {
		return nil, err
	}

	q := u.Query()

	// Extract required params
	to := q.Get("to")
	amount := q.Get("amount")
	signature := q.Get("sig")
	expiryStr := q.Get("exp")

	if to == "" || amount == "" || signature == "" || expiryStr == "" {
		return nil, fmt.Errorf("missing required parameters")
	}

	expiry, err := strconv.ParseInt(expiryStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid expiry timestamp")
	}

	// Extract optional params
	tokenStr := q.Get("token")
	if tokenStr == "" {
		tokenStr = string(DefaultToken)
	}
	token := TokenSymbol(tokenStr)

	chainStr := q.Get("chain")
	var chain ChainID
	if chainStr != "" {
		if chainNum, err := strconv.Atoi(chainStr); err == nil {
			chain = NumericChainID(chainNum)
		} else {
			chain = StringChainID(chainStr)
		}
	}

	memo := q.Get("memo")
	orderID := q.Get("orderId")
	callbackURL := q.Get("callback")

	// Parse allowed chains
	var allowedChains []ChainID
	if chainsStr := q.Get("chains"); chainsStr != "" {
		for _, c := range strings.Split(chainsStr, ",") {
			if chainNum, err := strconv.Atoi(c); err == nil {
				allowedChains = append(allowedChains, NumericChainID(chainNum))
			} else {
				allowedChains = append(allowedChains, StringChainID(c))
			}
		}
	}

	// Parse allowed tokens
	var allowedTokens []TokenSymbol
	if tokensStr := q.Get("tokens"); tokensStr != "" {
		for _, t := range strings.Split(tokensStr, ",") {
			allowedTokens = append(allowedTokens, TokenSymbol(t))
		}
	}

	// Calculate expiry hours from timestamp
	nowMs := time.Now().UnixMilli()
	expiryHours := int((expiry - nowMs) / (60 * 60 * 1000))
	if expiryHours < 1 {
		expiryHours = 1
	}

	params := &PaymentLinkParams{
		To:            to,
		Amount:        amount,
		Token:         token,
		Chain:         chain,
		ExpiryHours:   expiryHours,
		Memo:          memo,
		OrderID:       orderID,
		CallbackURL:   callbackURL,
		AllowedChains: allowedChains,
		AllowedTokens: allowedTokens,
	}

	return &parsedURL{
		params:    params,
		signature: signature,
		expiry:    expiry,
	}, nil
}
