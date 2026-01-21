package protocolbanks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ============================================================================
// HTTP Client
// ============================================================================

// HTTPClient is an HTTP client for the ProtocolBanks API.
type HTTPClient struct {
	baseURL     string
	apiKey      string
	apiSecret   string
	httpClient  *http.Client
	retryConfig RetryConfig
}

// NewHTTPClient creates a new HTTP client.
func NewHTTPClient(config *Config) *HTTPClient {
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	retryConfig := DefaultRetryConfig()
	if config.RetryConfig != nil {
		retryConfig = *config.RetryConfig
	}

	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = GetAPIBaseURL(config.Environment)
	}

	return &HTTPClient{
		baseURL:   baseURL,
		apiKey:    config.APIKey,
		apiSecret: config.APISecret,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		retryConfig: retryConfig,
	}
}

// Get performs a GET request.
func (c *HTTPClient) Get(ctx context.Context, path string, result interface{}) error {
	return c.doRequest(ctx, http.MethodGet, path, nil, result)
}

// Post performs a POST request.
func (c *HTTPClient) Post(ctx context.Context, path string, body, result interface{}) error {
	return c.doRequest(ctx, http.MethodPost, path, body, result)
}

// Put performs a PUT request.
func (c *HTTPClient) Put(ctx context.Context, path string, body, result interface{}) error {
	return c.doRequest(ctx, http.MethodPut, path, body, result)
}

// Delete performs a DELETE request.
func (c *HTTPClient) Delete(ctx context.Context, path string, result interface{}) error {
	return c.doRequest(ctx, http.MethodDelete, path, nil, result)
}

func (c *HTTPClient) doRequest(ctx context.Context, method, path string, body, result interface{}) error {
	var lastErr error

	for attempt := 0; attempt <= c.retryConfig.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := c.calculateDelay(attempt)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		err := c.executeRequest(ctx, method, path, body, result)
		if err == nil {
			return nil
		}

		lastErr = err

		// Check if error is retryable
		if sdkErr, ok := err.(*SDKError); ok {
			if !sdkErr.IsRetryable() {
				return err
			}
		}
	}

	return lastErr
}

func (c *HTTPClient) executeRequest(ctx context.Context, method, path string, body, result interface{}) error {
	url := c.baseURL + path

	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid,
				"Failed to marshal request body")
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return NewNetworkError("Failed to create request")
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("User-Agent", "protocolbanks-go/1.0.0")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return NewNetworkError("Request failed: " + err.Error())
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return NewNetworkError("Failed to read response body")
	}

	// Handle error responses
	if resp.StatusCode >= 400 {
		return c.handleErrorResponse(resp.StatusCode, respBody)
	}

	// Parse successful response
	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid,
				"Failed to parse response")
		}
	}

	return nil
}

func (c *HTTPClient) handleErrorResponse(statusCode int, body []byte) error {
	// Try to parse error response
	var errResp struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}

	if err := json.Unmarshal(body, &errResp); err == nil && errResp.Code != "" {
		category := c.categoryFromCode(errResp.Code)
		return NewSDKError(errResp.Code, category, errResp.Message)
	}

	// Generic error based on status code
	switch statusCode {
	case http.StatusUnauthorized:
		return NewSDKError(ErrAuthInvalidAPIKey, ErrorCategoryAuth, "Invalid API key")
	case http.StatusForbidden:
		return NewSDKError(ErrAuthInsufficientPermissions, ErrorCategoryAuth, "Insufficient permissions")
	case http.StatusNotFound:
		return NewSDKError(ErrValidInvalidFormat, ErrorCategoryValid, "Resource not found")
	case http.StatusTooManyRequests:
		return NewRateLimitError(time.Minute)
	case http.StatusInternalServerError:
		return NewNetworkError("Internal server error").WithRetryable(true)
	default:
		return NewNetworkError(fmt.Sprintf("Request failed with status %d", statusCode))
	}
}

func (c *HTTPClient) categoryFromCode(code string) ErrorCategory {
	if len(code) < 7 {
		return ErrorCategoryNet
	}

	// Extract category from code (e.g., PB_AUTH_001 -> AUTH)
	parts := code[3:] // Remove "PB_"
	for i, ch := range parts {
		if ch == '_' {
			cat := parts[:i]
			switch cat {
			case "AUTH":
				return ErrorCategoryAuth
			case "LINK":
				return ErrorCategoryLink
			case "X402":
				return ErrorCategoryX402
			case "BATCH":
				return ErrorCategoryBatch
			case "NET":
				return ErrorCategoryNet
			case "RATE":
				return ErrorCategoryRate
			case "VALID":
				return ErrorCategoryValid
			case "CRYPTO":
				return ErrorCategoryCrypto
			case "CHAIN":
				return ErrorCategoryChain
			}
			break
		}
	}

	return ErrorCategoryNet
}

func (c *HTTPClient) calculateDelay(attempt int) time.Duration {
	delay := c.retryConfig.InitialDelay
	for i := 1; i < attempt; i++ {
		delay = time.Duration(float64(delay) * c.retryConfig.BackoffMultiplier)
		if delay > c.retryConfig.MaxDelay {
			delay = c.retryConfig.MaxDelay
			break
		}
	}
	return delay
}

// Close closes the HTTP client.
func (c *HTTPClient) Close() error {
	c.httpClient.CloseIdleConnections()
	return nil
}
