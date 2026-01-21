package protocolbanks

// ============================================================================
// Configuration Constants
// ============================================================================

const (
	// DefaultExpiryHours is the default payment link expiry time.
	DefaultExpiryHours = 24

	// MaxExpiryHours is the maximum payment link expiry time.
	MaxExpiryHours = 168 // 7 days

	// MinExpiryHours is the minimum payment link expiry time.
	MinExpiryHours = 1

	// DefaultToken is the default token for payments.
	DefaultToken = TokenUSDC

	// MaxBatchSize is the maximum number of recipients in a batch.
	MaxBatchSize = 500

	// MaxMemoLength is the maximum length of a memo.
	MaxMemoLength = 256

	// MaxAmount is the maximum payment amount.
	MaxAmount = 1_000_000_000 // 1 billion

	// PaymentLinkBaseURL is the base URL for payment links.
	PaymentLinkBaseURL = "https://app.protocolbanks.com/pay"

	// APIBaseURL is the base URL for the API.
	APIBaseURL = "https://api.protocolbanks.com/v1"

	// SandboxAPIBaseURL is the base URL for the sandbox API.
	SandboxAPIBaseURL = "https://sandbox.api.protocolbanks.com/v1"

	// TestnetAPIBaseURL is the base URL for the testnet API.
	TestnetAPIBaseURL = "https://testnet.api.protocolbanks.com/v1"
)

// ============================================================================
// Chain Configuration
// ============================================================================

// SupportedChains returns all supported chain IDs.
func SupportedChains() []ChainID {
	return []ChainID{
		ChainEthereum,
		ChainPolygon,
		ChainBase,
		ChainArbitrum,
		ChainOptimism,
		ChainBSC,
		ChainSolana,
		ChainBitcoin,
	}
}

// EVMChains returns all EVM chain IDs.
func EVMChains() []NumericChainID {
	return []NumericChainID{
		ChainEthereum,
		ChainPolygon,
		ChainBase,
		ChainArbitrum,
		ChainOptimism,
		ChainBSC,
	}
}

// X402SupportedChains returns chains that support x402 gasless payments.
func X402SupportedChains() []NumericChainID {
	return []NumericChainID{
		ChainEthereum,
		ChainPolygon,
		ChainBase,
		ChainArbitrum,
		ChainOptimism,
	}
}

// X402SupportedTokens returns tokens that support x402 gasless payments.
func X402SupportedTokens() []TokenSymbol {
	return []TokenSymbol{TokenUSDC, TokenDAI}
}

// ============================================================================
// Token Configuration
// ============================================================================

// TokensForChain returns supported tokens for a chain.
func TokensForChain(chain ChainID) []TokenSymbol {
	switch chain {
	case ChainEthereum:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI, TokenETH}
	case ChainPolygon:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI, TokenMATIC}
	case ChainBase:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenETH}
	case ChainArbitrum:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI, TokenETH}
	case ChainOptimism:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI, TokenETH}
	case ChainBSC:
		return []TokenSymbol{TokenUSDC, TokenUSDT, TokenDAI, TokenBNB}
	case ChainSolana:
		return []TokenSymbol{TokenSOL, TokenUSDC}
	case ChainBitcoin:
		return []TokenSymbol{TokenBTC}
	default:
		return nil
	}
}

// ChainsForToken returns chains that support a token.
func ChainsForToken(token TokenSymbol) []ChainID {
	var chains []ChainID
	for _, chain := range SupportedChains() {
		for _, t := range TokensForChain(chain) {
			if t == token {
				chains = append(chains, chain)
				break
			}
		}
	}
	return chains
}

// TokenDecimals returns the decimals for a token on a chain.
func TokenDecimals(chain ChainID, token TokenSymbol) int {
	// Most stablecoins use 6 decimals on EVM chains
	switch token {
	case TokenUSDC, TokenUSDT:
		return 6
	case TokenDAI:
		return 18
	case TokenETH, TokenMATIC, TokenBNB:
		return 18
	case TokenSOL:
		return 9
	case TokenBTC:
		return 8
	default:
		return 18
	}
}

// USDCAddresses returns USDC contract addresses by chain ID.
var USDCAddresses = map[NumericChainID]string{
	ChainEthereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	ChainPolygon:  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
	ChainBase:     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	ChainArbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
	ChainOptimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
	ChainBSC:      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
}

// GetAPIBaseURL returns the API base URL for an environment.
func GetAPIBaseURL(env Environment) string {
	switch env {
	case EnvSandbox:
		return SandboxAPIBaseURL
	case EnvTestnet:
		return TestnetAPIBaseURL
	default:
		return APIBaseURL
	}
}
