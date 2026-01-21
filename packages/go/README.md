# ProtocolBanks Go SDK

Go SDK for ProtocolBanks payment services. Supports multi-chain cryptocurrency payments with USDC, USDT, DAI, ETH, and more.

## Installation

```bash
go get github.com/protocolbanks/protocolbanks-go
```

## Quick Start

```go
package main

import (
    "fmt"
    "log"

    pb "github.com/protocolbanks/protocolbanks-go"
)

func main() {
    // Initialize client
    client, err := pb.NewClient(&pb.Config{
        APIKey:      "pk_live_xxx",
        APISecret:   "sk_live_xxx",
        Environment: pb.EnvProduction,
    })
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Generate payment link
    link, err := client.Links.Generate(pb.PaymentLinkParams{
        To:          "0x1234567890123456789012345678901234567890",
        Amount:      "100",
        Token:       pb.TokenUSDC,
        ExpiryHours: 24,
        Memo:        "Invoice #12345",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Payment URL:", link.URL)
    fmt.Println("Short URL:", link.ShortURL)
    fmt.Println("Expires at:", link.ExpiresAt)
}
```

## Features

### Payment Links

Generate and verify signed payment links:

```go
// Generate payment link
link, err := client.Links.Generate(pb.PaymentLinkParams{
    To:            "0x1234...",
    Amount:        "100",
    Token:         pb.TokenUSDC,
    ExpiryHours:   24,
    Memo:          "Order #123",
    AllowedChains: []pb.ChainID{pb.ChainEthereum, pb.ChainPolygon},
})

// Verify payment link
result := client.Links.Verify(link.URL)
if result.Valid {
    fmt.Println("Link is valid")
    fmt.Println("Recipient:", result.Params.To)
    fmt.Println("Amount:", result.Params.Amount)
} else {
    fmt.Println("Invalid link:", result.Error)
    if result.HomoglyphDetected {
        fmt.Println("Homoglyph attack detected!")
    }
}

// Parse payment link
params, err := client.Links.Parse(link.URL)
```

### x402 Gasless Payments

Create EIP-712 authorizations for gasless payments:

```go
import "context"

ctx := context.Background()

// Create authorization
auth, err := client.X402.CreateAuthorization(ctx, pb.X402AuthorizationParams{
    To:      "0x1234...",
    Amount:  "100",
    Token:   pb.TokenUSDC,
    ChainID: 1, // Ethereum
})
if err != nil {
    log.Fatal(err)
}

fmt.Println("Authorization ID:", auth.ID)
fmt.Println("Expires at:", auth.ExpiresAt)

// Get typed data for signing
typedData := client.X402.GetTypedData(auth, "0xUserAddress...")

// After user signs, submit signature
auth, err = client.X402.SubmitSignature(ctx, auth.ID, "0xSignature...")
if err != nil {
    log.Fatal(err)
}

fmt.Println("Status:", auth.Status)
fmt.Println("Transaction:", auth.TransactionHash)
```

### Batch Payments

Process batch payments (up to 500 recipients):

```go
ctx := context.Background()

recipients := []pb.BatchRecipient{
    {Address: "0x1111...", Amount: "100", Token: pb.TokenUSDC},
    {Address: "0x2222...", Amount: "200", Token: pb.TokenUSDC},
    {Address: "0x3333...", Amount: "150", Token: pb.TokenUSDC},
}

// Validate batch
errors, err := client.Batch.Validate(recipients)
if err != nil {
    log.Fatal(err)
}
if len(errors) > 0 {
    for _, e := range errors {
        fmt.Printf("Error at index %d: %v\n", e.Index, e.Errors)
    }
}

// Submit batch
result, err := client.Batch.Submit(ctx, recipients, &pb.BatchOptions{
    Priority: pb.BatchPriorityMedium,
})
if err != nil {
    log.Fatal(err)
}

fmt.Println("Batch ID:", result.BatchID)

// Poll for status
stopPolling := client.Batch.Poll(ctx, result.BatchID, func(status *pb.BatchStatus) {
    progress := client.Batch.GetProgress(status)
    fmt.Printf("Progress: %d%% (%d/%d completed)\n", 
        progress, status.Progress.Completed, status.Progress.Total)
}, 5*time.Second)

// Stop polling when done
defer stopPolling()
```

### Webhooks

Verify webhook signatures:

```go
// In your HTTP handler
func webhookHandler(w http.ResponseWriter, r *http.Request) {
    payload, _ := io.ReadAll(r.Body)
    signature := r.Header.Get("X-PB-Signature")
    
    result := client.Webhooks.Verify(string(payload), signature, "whsec_xxx", 0)
    if !result.Valid {
        http.Error(w, result.Error, http.StatusUnauthorized)
        return
    }
    
    event := result.Event
    fmt.Println("Event type:", event.Type)
    
    switch {
    case pb.IsPaymentEvent(event):
        data, _ := pb.ParsePaymentEvent(event)
        fmt.Println("Payment ID:", data.PaymentID)
    case pb.IsBatchEvent(event):
        data, _ := pb.ParseBatchEvent(event)
        fmt.Println("Batch ID:", data.BatchID)
    case pb.IsX402Event(event):
        data, _ := pb.ParseX402Event(event)
        fmt.Println("Authorization ID:", data.AuthorizationID)
    }
    
    w.WriteHeader(http.StatusOK)
}

// Generate signature for testing
signature := client.Webhooks.Sign(payload, "whsec_xxx", 0)
```

## Supported Chains

| Chain | Chain ID | Tokens |
|-------|----------|--------|
| Ethereum | 1 | USDC, USDT, DAI, ETH |
| Polygon | 137 | USDC, USDT, DAI, MATIC |
| Base | 8453 | USDC, USDT, ETH |
| Arbitrum | 42161 | USDC, USDT, DAI, ETH |
| Optimism | 10 | USDC, USDT, DAI, ETH |
| BSC | 56 | USDC, USDT, DAI, BNB |
| Solana | "solana" | SOL, USDC |
| Bitcoin | "bitcoin" | BTC |

## Error Handling

All errors follow the pattern `PB_{CATEGORY}_{NNN}`:

```go
link, err := client.Links.Generate(params)
if err != nil {
    if sdkErr, ok := err.(*pb.SDKError); ok {
        fmt.Println("Error code:", sdkErr.Code)
        fmt.Println("Category:", sdkErr.Category)
        fmt.Println("Message:", sdkErr.Message)
        
        if sdkErr.IsRetryable() {
            // Retry after delay
            time.Sleep(sdkErr.RetryAfter)
        }
    }
}
```

## Configuration

```go
client, err := pb.NewClient(&pb.Config{
    APIKey:      "pk_live_xxx",
    APISecret:   "sk_live_xxx",
    Environment: pb.EnvProduction, // or EnvSandbox, EnvTestnet
    Timeout:     30 * time.Second,
    RetryConfig: &pb.RetryConfig{
        MaxRetries:        3,
        InitialDelay:      time.Second,
        MaxDelay:          30 * time.Second,
        BackoffMultiplier: 2.0,
    },
    DefaultChain:    pb.ChainEthereum,
    SupportedChains: []pb.ChainID{pb.ChainEthereum, pb.ChainPolygon},
    SupportedTokens: []pb.TokenSymbol{pb.TokenUSDC, pb.TokenUSDT},
})
```

## License

MIT License - see LICENSE file for details.
