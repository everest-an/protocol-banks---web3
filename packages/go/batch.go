package protocolbanks

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// Batch Module
// ============================================================================

// BatchModule handles batch payment processing.
type BatchModule struct {
	http             *HTTPClient
	batches          sync.Map // map[string]*BatchStatus
	pollingIntervals sync.Map // map[string]chan struct{}
}

// NewBatchModule creates a new BatchModule.
func NewBatchModule(http *HTTPClient) *BatchModule {
	return &BatchModule{
		http: http,
	}
}

// Validate validates batch recipients.
// Returns errors for ALL invalid entries (not just first).
func (m *BatchModule) Validate(recipients []BatchRecipient) ([]BatchValidationError, error) {
	// Check batch size
	if err := ValidateBatchSize(len(recipients)); err != nil {
		return nil, err
	}

	var errors []BatchValidationError

	// Validate each recipient
	for i, recipient := range recipients {
		var recipientErrors []string

		// Validate address
		if recipient.Address == "" {
			recipientErrors = append(recipientErrors, "Address is required")
		} else {
			// Check for homoglyphs
			if homoglyphDetails := DetectHomoglyphs(recipient.Address); homoglyphDetails != nil {
				recipientErrors = append(recipientErrors, "Address contains suspicious characters (possible homoglyph attack)")
			} else if !IsValidAddress(recipient.Address) {
				recipientErrors = append(recipientErrors, "Invalid address format")
			}
		}

		// Validate amount
		if recipient.Amount == "" {
			recipientErrors = append(recipientErrors, "Amount is required")
		} else if !IsValidAmount(recipient.Amount) {
			recipientErrors = append(recipientErrors, "Invalid amount (must be positive, max 1 billion)")
		}

		// Validate token
		if recipient.Token == "" {
			recipientErrors = append(recipientErrors, "Token is required")
		} else if !IsValidToken(recipient.Token) {
			recipientErrors = append(recipientErrors, fmt.Sprintf("Unsupported token: %s", recipient.Token))
		}

		// Validate memo length
		if len(recipient.Memo) > MaxMemoLength {
			recipientErrors = append(recipientErrors, "Memo exceeds maximum length of 256 characters")
		}

		// Add errors if any
		if len(recipientErrors) > 0 {
			errors = append(errors, BatchValidationError{
				Index:   i,
				Address: recipient.Address,
				Errors:  recipientErrors,
			})
		}
	}

	// Check for duplicate addresses
	addressCounts := make(map[string][]int)
	for i, recipient := range recipients {
		address := strings.ToLower(recipient.Address)
		if address != "" {
			addressCounts[address] = append(addressCounts[address], i)
		}
	}

	for address, indices := range addressCounts {
		if len(indices) > 1 {
			// Add warning for duplicates
			for _, index := range indices {
				found := false
				for i := range errors {
					if errors[i].Index == index {
						errors[i].Errors = append(errors[i].Errors,
							fmt.Sprintf("Duplicate address (appears %d times)", len(indices)))
						found = true
						break
					}
				}
				if !found {
					errors = append(errors, BatchValidationError{
						Index:   index,
						Address: address,
						Errors:  []string{fmt.Sprintf("Duplicate address (appears %d times)", len(indices))},
					})
				}
			}
		}
	}

	// Sort errors by index
	for i := 0; i < len(errors)-1; i++ {
		for j := i + 1; j < len(errors); j++ {
			if errors[i].Index > errors[j].Index {
				errors[i], errors[j] = errors[j], errors[i]
			}
		}
	}

	return errors, nil
}

// Submit submits a batch payment.
func (m *BatchModule) Submit(ctx context.Context, recipients []BatchRecipient, options *BatchOptions) (*BatchSubmitResult, error) {
	// Validate batch
	validationErrors, err := m.Validate(recipients)
	if err != nil {
		return nil, err
	}

	// Filter out warnings (duplicates) vs errors
	var criticalErrors []BatchValidationError
	for _, e := range validationErrors {
		hasCritical := false
		for _, errMsg := range e.Errors {
			if !strings.Contains(errMsg, "Duplicate") {
				hasCritical = true
				break
			}
		}
		if hasCritical {
			criticalErrors = append(criticalErrors, e)
		}
	}

	if len(criticalErrors) > 0 {
		return &BatchSubmitResult{
			BatchID:      "",
			Status:       "failed",
			ValidCount:   len(recipients) - len(criticalErrors),
			InvalidCount: len(criticalErrors),
			Errors:       criticalErrors,
		}, nil
	}

	// Generate batch ID
	batchID := GenerateBatchID()

	// Calculate total amount
	var totalAmount float64
	for _, r := range recipients {
		if amount, err := strconv.ParseFloat(r.Amount, 64); err == nil {
			totalAmount += amount
		}
	}

	// Prepare batch items
	items := make([]BatchItemStatus, len(recipients))
	for i, r := range recipients {
		items[i] = BatchItemStatus{
			Index:   i,
			Address: r.Address,
			Amount:  r.Amount,
			Status:  "pending",
		}
	}

	// Create batch status
	batchStatus := &BatchStatus{
		BatchID: batchID,
		Status:  "pending",
		Progress: BatchProgress{
			Total:     len(recipients),
			Completed: 0,
			Failed:    0,
			Pending:   len(recipients),
		},
		Items:       items,
		TotalAmount: fmt.Sprintf("%.6f", totalAmount),
		CreatedAt:   time.Now(),
	}

	// Store locally
	m.batches.Store(batchID, batchStatus)

	// Prepare request body
	recipientData := make([]map[string]interface{}, len(recipients))
	for i, r := range recipients {
		recipientData[i] = map[string]interface{}{
			"address": r.Address,
			"amount":  r.Amount,
			"token":   r.Token,
			"memo":    r.Memo,
			"orderId": r.OrderID,
		}
	}

	requestBody := map[string]interface{}{
		"batchId":    batchID,
		"recipients": recipientData,
	}

	if options != nil {
		if options.Chain != nil {
			requestBody["chain"] = options.Chain
		}
		if options.Priority != "" {
			requestBody["priority"] = options.Priority
		} else {
			requestBody["priority"] = BatchPriorityMedium
		}
		if options.WebhookURL != "" {
			requestBody["webhookUrl"] = options.WebhookURL
		}
		if options.IdempotencyKey != "" {
			requestBody["idempotencyKey"] = options.IdempotencyKey
		}
	}

	// Submit to backend
	var response BatchSubmitResult
	if err := m.http.Post(ctx, "/batch/submit", requestBody, &response); err != nil {
		batchStatus.Status = "failed"
		return nil, err
	}

	// Update local status
	batchStatus.Status = response.Status

	return &BatchSubmitResult{
		BatchID:      batchID,
		Status:       response.Status,
		ValidCount:   len(recipients),
		InvalidCount: 0,
		Errors:       nil,
		EstimatedFee: response.EstimatedFee,
	}, nil
}

// GetStatus gets the status of a batch.
func (m *BatchModule) GetStatus(ctx context.Context, batchID string) (*BatchStatus, error) {
	// Check local cache first
	if batch, ok := m.batches.Load(batchID); ok {
		localBatch := batch.(*BatchStatus)

		// Fetch from backend
		var response BatchStatus
		if err := m.http.Get(ctx, "/batch/"+batchID, &response); err == nil {
			// Update local cache
			localBatch.Status = response.Status
			localBatch.Progress = response.Progress
			localBatch.Items = response.Items
			if response.TotalFee != "" {
				localBatch.TotalFee = response.TotalFee
			}
			if response.CompletedAt != nil {
				localBatch.CompletedAt = response.CompletedAt
			}
		}

		return localBatch, nil
	}

	// Fetch from backend
	var response BatchStatus
	if err := m.http.Get(ctx, "/batch/"+batchID, &response); err != nil {
		return nil, NewSDKError(ErrBatchNotFound, ErrorCategoryBatch,
			fmt.Sprintf("Batch %s not found", batchID))
	}

	// Cache locally
	m.batches.Store(batchID, &response)

	return &response, nil
}

// Retry retries failed items in a batch.
func (m *BatchModule) Retry(ctx context.Context, batchID string, itemIndices []int) (*BatchSubmitResult, error) {
	batch, err := m.GetStatus(ctx, batchID)
	if err != nil {
		return nil, err
	}

	// Check if batch can be retried
	if batch.Status == "processing" {
		return nil, NewSDKError(ErrBatchAlreadyProcessing, ErrorCategoryBatch,
			"Batch is currently processing, cannot retry")
	}

	// Get failed items
	var failedItems []BatchItemStatus
	for _, item := range batch.Items {
		if item.Status == "failed" {
			if itemIndices == nil || contains(itemIndices, item.Index) {
				failedItems = append(failedItems, item)
			}
		}
	}

	if len(failedItems) == 0 {
		return &BatchSubmitResult{
			BatchID:      batchID,
			Status:       batch.Status,
			ValidCount:   0,
			InvalidCount: 0,
			Errors:       nil,
		}, nil
	}

	// Submit retry request
	indices := make([]int, len(failedItems))
	for i, item := range failedItems {
		indices[i] = item.Index
	}

	var response BatchSubmitResult
	if err := m.http.Post(ctx, "/batch/"+batchID+"/retry", map[string]interface{}{
		"itemIndices": indices,
	}, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// Poll polls batch status with a callback.
func (m *BatchModule) Poll(ctx context.Context, batchID string, callback func(*BatchStatus), interval time.Duration) func() {
	if interval == 0 {
		interval = 5 * time.Second
	}

	// Create stop channel
	stopCh := make(chan struct{})
	m.pollingIntervals.Store(batchID, stopCh)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Initial poll
		if status, err := m.GetStatus(ctx, batchID); err == nil {
			callback(status)
			if m.isFinalStatus(status.Status) {
				m.StopPolling(batchID)
				return
			}
		}

		for {
			select {
			case <-stopCh:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				status, err := m.GetStatus(ctx, batchID)
				if err != nil {
					continue
				}
				callback(status)
				if m.isFinalStatus(status.Status) {
					m.StopPolling(batchID)
					return
				}
			}
		}
	}()

	return func() { m.StopPolling(batchID) }
}

// StopPolling stops polling for a batch.
func (m *BatchModule) StopPolling(batchID string) {
	if ch, ok := m.pollingIntervals.Load(batchID); ok {
		close(ch.(chan struct{}))
		m.pollingIntervals.Delete(batchID)
	}
}

// StopAllPolling stops all polling.
func (m *BatchModule) StopAllPolling() {
	m.pollingIntervals.Range(func(key, value interface{}) bool {
		close(value.(chan struct{}))
		m.pollingIntervals.Delete(key)
		return true
	})
}

// CalculateTotal calculates total amounts by token.
func (m *BatchModule) CalculateTotal(recipients []BatchRecipient) (byToken map[TokenSymbol]string, totalUSD string) {
	byTokenFloat := make(map[TokenSymbol]float64)

	for _, recipient := range recipients {
		if amount, err := strconv.ParseFloat(recipient.Amount, 64); err == nil {
			byTokenFloat[recipient.Token] += amount
		}
	}

	byToken = make(map[TokenSymbol]string)
	for token, amount := range byTokenFloat {
		byToken[token] = fmt.Sprintf("%.6f", amount)
	}

	// Estimate USD total (assuming stablecoins = $1)
	stablecoins := []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI}
	var totalUSDFloat float64
	for _, token := range stablecoins {
		if amount, ok := byTokenFloat[token]; ok {
			totalUSDFloat += amount
		}
	}

	totalUSD = fmt.Sprintf("%.2f", totalUSDFloat)
	return
}

// GetProgress returns batch progress percentage.
func (m *BatchModule) GetProgress(status *BatchStatus) int {
	if status.Progress.Total == 0 {
		return 0
	}
	return int(float64(status.Progress.Completed+status.Progress.Failed) / float64(status.Progress.Total) * 100)
}

// ============================================================================
// Private Methods
// ============================================================================

func (m *BatchModule) isFinalStatus(status string) bool {
	return status == "completed" || status == "failed"
}

func contains(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}
