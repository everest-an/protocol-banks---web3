// Package protocolbanks provides a Go SDK for ProtocolBanks payment services.
//
// Example usage:
//
//	client, err := protocolbanks.NewClient(&protocolbanks.Config{
//		APIKey:      "pk_live_xxx",
//		APISecret:   "sk_live_xxx",
//		Environment: protocolbanks.EnvProduction,
//	})
//	if err != nil {
//		log.Fatal(err)
//	}
//	defer client.Close()
//
//	// Generate payment link
//	link, err := client.Links.Generate(protocolbanks.PaymentLinkParams{
//		To:     "0x1234567890123456789012345678901234567890",
//		Amount: "100",
//		Token:  protocolbanks.TokenUSDC,
//	})
//	if err != nil {
//		log.Fatal(err)
//	}
//	fmt.Println("Payment URL:", link.URL)
package protocolbanks

import (
	"errors"
	"time"
)

// ============================================================================
// Client
// ============================================================================

// Client is the main ProtocolBanks SDK client.
type Client struct {
	// Links provides payment link generation and verification.
	Links *PaymentLinkModule

	// X402 provides x402 gasless payment authorization.
	X402 *X402Module

	// Batch provides batch payment processing.
	Batch *BatchModule

	// Webhooks provides webhook signature verification.
	Webhooks *WebhookModule

	config *Config
	http   *HTTPClient
}

// NewClient creates a new ProtocolBanks client.
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		return nil, errors.New("config is required")
	}

	if config.APIKey == "" {
		return nil, NewSDKError(ErrAuthInvalidAPIKey, ErrorCategoryAuth, "API key is required")
	}

	if config.APISecret == "" {
		return nil, NewSDKError(ErrAuthInvalidSecret, ErrorCategoryAuth, "API secret is required")
	}

	// Set defaults
	if config.Environment == "" {
		config.Environment = EnvProduction
	}

	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}

	// Create HTTP client
	http := NewHTTPClient(config)

	// Create modules
	links := NewPaymentLinkModule(config.APISecret, config.BaseURL)
	x402 := NewX402Module(http)
	batch := NewBatchModule(http)
	webhooks := NewWebhookModule()

	return &Client{
		Links:    links,
		X402:     x402,
		Batch:    batch,
		Webhooks: webhooks,
		config:   config,
		http:     http,
	}, nil
}

// Close closes the client and releases resources.
func (c *Client) Close() error {
	// Stop all batch polling
	c.Batch.StopAllPolling()

	// Clean up x402 authorizations
	c.X402.CleanupExpired()

	// Close HTTP client
	return c.http.Close()
}

// Environment returns the current environment.
func (c *Client) Environment() Environment {
	return c.config.Environment
}

// DefaultChain returns the default chain.
func (c *Client) DefaultChain() ChainID {
	return c.config.DefaultChain
}

// SupportedChains returns the configured supported chains.
func (c *Client) SupportedChains() []ChainID {
	if c.config.SupportedChains != nil {
		return c.config.SupportedChains
	}
	return SupportedChains()
}

// SupportedTokens returns the configured supported tokens.
func (c *Client) SupportedTokens() []TokenSymbol {
	if c.config.SupportedTokens != nil {
		return c.config.SupportedTokens
	}
	return SupportedTokens()
}

// ============================================================================
// Convenience Methods
// ============================================================================

// GeneratePaymentLink is a convenience method for generating a payment link.
func (c *Client) GeneratePaymentLink(to, amount string, token TokenSymbol) (*PaymentLink, error) {
	return c.Links.Generate(PaymentLinkParams{
		To:     to,
		Amount: amount,
		Token:  token,
	})
}

// VerifyPaymentLink is a convenience method for verifying a payment link.
func (c *Client) VerifyPaymentLink(url string) *LinkVerificationResult {
	return c.Links.Verify(url)
}

// VerifyWebhook is a convenience method for verifying a webhook.
func (c *Client) VerifyWebhook(payload, signature, secret string) *WebhookVerificationResult {
	return c.Webhooks.Verify(payload, signature, secret, 0)
}
