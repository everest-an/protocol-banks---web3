package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	tronclient "github.com/fbsobreira/gotron-sdk/pkg/client"
	tronapi "github.com/fbsobreira/gotron-sdk/pkg/proto/api"
	troncore "github.com/fbsobreira/gotron-sdk/pkg/proto/core"
	"github.com/protocol-bank/payout-engine/internal/config"
	"github.com/protocol-bank/payout-engine/internal/nonce"
	"github.com/protocol-bank/payout-engine/internal/queue"
	"github.com/rs/zerolog/log"
	"google.golang.org/protobuf/proto"
)

// ERC20 ABI (只需要 transfer 函数)
const erc20ABI = `[{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"}]`

// PayoutService 支付服务
type PayoutService struct {
	cfg          *config.Config
	nonceManager *nonce.Manager
	queue        *queue.Consumer
	clients      map[uint64]*ethclient.Client
	tronClients  map[uint64]*tronclient.GrpcClient
	erc20ABI     abi.ABI
}

// NewPayoutService 创建支付服务
func NewPayoutService(
	ctx context.Context,
	cfg *config.Config,
	nonceManager *nonce.Manager,
	queueConsumer *queue.Consumer,
) (*PayoutService, error) {
	// 解析 ERC20 ABI
	parsedABI, err := abi.JSON(strings.NewReader(erc20ABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ERC20 ABI: %w", err)
	}

	// 初始化链客户端
	clients := make(map[uint64]*ethclient.Client)
	tronClients := make(map[uint64]*tronclient.GrpcClient)

	for chainID, chainCfg := range cfg.Chains {
		if chainCfg.Type == "tron" {
			client := tronclient.NewGrpcClient(chainCfg.RPCURL)
			if err := client.Start(); err != nil {
				log.Warn().Err(err).Uint64("chain_id", chainID).Msg("Failed to connect to Tron chain")
				continue
			}
			tronClients[chainID] = client
			log.Info().Uint64("chain_id", chainID).Str("name", chainCfg.Name).Msg("Connected to Tron chain")
		} else {
			client, err := ethclient.Dial(chainCfg.RPCURL)
			if err != nil {
				log.Warn().Err(err).Uint64("chain_id", chainID).Msg("Failed to connect to chain")
				continue
			}
			clients[chainID] = client
			nonceManager.AddChainClient(chainID, client)
			log.Info().Uint64("chain_id", chainID).Str("name", chainCfg.Name).Msg("Connected to chain")
		}
	}

	return &PayoutService{
		cfg:          cfg,
		nonceManager: nonceManager,
		queue:        queueConsumer,
		clients:      clients,
		tronClients:  tronClients,
		erc20ABI:     parsedABI,
	}, nil
}

// SubmitBatchPayout 提交批量支付
func (s *PayoutService) SubmitBatchPayout(ctx context.Context, req *BatchPayoutRequest) (*BatchPayoutResponse, error) {
	log.Info().
		Str("batch_id", req.BatchID).
		Int("items", len(req.Items)).
		Uint64("chain_id", req.ChainID).
		Msg("Submitting batch payout")

	// 验证请求
	if err := s.validateRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// 创建任务
	jobs := make([]*queue.Job, len(req.Items))
	for i, item := range req.Items {
		jobs[i] = &queue.Job{
			ID:            item.ID,
			BatchID:       req.BatchID,
			UserID:        req.UserID,
			FromAddress:   req.FromAddress,
			ToAddress:     item.RecipientAddress,
			Amount:        item.Amount,
			TokenAddress:  item.TokenAddress,
			TokenSymbol:   item.TokenSymbol,
			TokenDecimals: item.TokenDecimals,
			ChainID:       req.ChainID,
			RetryCount:    0,
			CreatedAt:     time.Now(),
		}
	}

	// 批量入队
	if err := s.queue.PushBatch(ctx, jobs); err != nil {
		return nil, fmt.Errorf("failed to queue jobs: %w", err)
	}

	return &BatchPayoutResponse{
		BatchID: req.BatchID,
		Status:  BatchStatusQueued,
		Message: fmt.Sprintf("Queued %d payments for processing", len(jobs)),
	}, nil
}

// ProcessJob 处理单个支付任务
func (s *PayoutService) ProcessJob(ctx context.Context, job *queue.Job) (*queue.JobResult, error) {
	log.Info().
		Str("job_id", job.ID).
		Str("to", job.ToAddress).
		Str("amount", job.Amount).
		Msg("Processing payout job")

	// Check if this is a Tron chain
	if tronClient, ok := s.tronClients[job.ChainID]; ok {
		return s.processTronJob(ctx, tronClient, job)
	}

	// 获取链客户端
	client, ok := s.clients[job.ChainID]
	if !ok {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("unsupported chain: %d", job.ChainID),
		}, nil
	}

	// 获取 Nonce
	fromAddr := common.HexToAddress(job.FromAddress)
	nonceVal, releaseFn, err := s.nonceManager.GetNonce(ctx, job.ChainID, fromAddr)
	if err != nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to get nonce: %w", err),
		}, nil
	}
	defer releaseFn()

	// 构建交易
	var tx *types.Transaction
	if job.TokenAddress == "" || job.TokenAddress == "0x0000000000000000000000000000000000000000" {
		// 原生代币转账
		tx, err = s.buildNativeTransfer(ctx, client, job, nonceVal)
	} else {
		// ERC20 转账
		tx, err = s.buildERC20Transfer(ctx, client, job, nonceVal)
	}
	if err != nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to build transaction: %w", err),
		}, nil
	}

	// 签名交易 (这里需要从安全存储获取私钥)
	// 注意：生产环境应使用 HSM 或 KMS
	signedTx, err := s.signTransaction(ctx, tx, job.ChainID)
	if err != nil {
		// Nonce 错误时重置
		if strings.Contains(err.Error(), "nonce") {
			s.nonceManager.ResetNonce(ctx, job.ChainID, fromAddr)
		}
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to sign transaction: %w", err),
		}, nil
	}

	// 发送交易
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		// Nonce 错误时重置
		if strings.Contains(err.Error(), "nonce") {
			s.nonceManager.ResetNonce(ctx, job.ChainID, fromAddr)
		}
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to send transaction: %w", err),
		}, nil
	}

	txHash := signedTx.Hash().Hex()
	log.Info().
		Str("job_id", job.ID).
		Str("tx_hash", txHash).
		Msg("Transaction sent successfully")

	return &queue.JobResult{
		JobID:   job.ID,
		Success: true,
		TxHash:  txHash,
	}, nil
}

// buildNativeTransfer 构建原生代币转账交易
func (s *PayoutService) buildNativeTransfer(
	ctx context.Context,
	client *ethclient.Client,
	job *queue.Job,
	nonceVal uint64,
) (*types.Transaction, error) {
	toAddr := common.HexToAddress(job.ToAddress)
	value, ok := new(big.Int).SetString(job.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", job.Amount)
	}

	// 获取 Gas 价格
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// 增加 20% Gas 价格以加快确认
	gasPrice = new(big.Int).Mul(gasPrice, big.NewInt(120))
	gasPrice = new(big.Int).Div(gasPrice, big.NewInt(100))

	// 估算 Gas
	msg := ethereum.CallMsg{
		From:  common.HexToAddress(job.FromAddress),
		To:    &toAddr,
		Value: value,
	}
	gasLimit, err := client.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 21000 // 默认原生转账 Gas
	}

	// 增加 20% Gas Limit
	gasLimit = gasLimit * 120 / 100

	chainID := new(big.Int).SetUint64(job.ChainID)
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonceVal,
		GasTipCap: gasPrice,
		GasFeeCap: new(big.Int).Mul(gasPrice, big.NewInt(2)),
		Gas:       gasLimit,
		To:        &toAddr,
		Value:     value,
	})

	return tx, nil
}

// buildERC20Transfer 构建 ERC20 转账交易
func (s *PayoutService) buildERC20Transfer(
	ctx context.Context,
	client *ethclient.Client,
	job *queue.Job,
	nonceVal uint64,
) (*types.Transaction, error) {
	tokenAddr := common.HexToAddress(job.TokenAddress)
	toAddr := common.HexToAddress(job.ToAddress)
	amount, ok := new(big.Int).SetString(job.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", job.Amount)
	}

	// 编码 transfer 调用数据
	data, err := s.erc20ABI.Pack("transfer", toAddr, amount)
	if err != nil {
		return nil, fmt.Errorf("failed to pack transfer data: %w", err)
	}

	// 获取 Gas 价格
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// 增加 20% Gas 价格
	gasPrice = new(big.Int).Mul(gasPrice, big.NewInt(120))
	gasPrice = new(big.Int).Div(gasPrice, big.NewInt(100))

	// 估算 Gas
	msg := ethereum.CallMsg{
		From: common.HexToAddress(job.FromAddress),
		To:   &tokenAddr,
		Data: data,
	}
	gasLimit, err := client.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 100000 // 默认 ERC20 转账 Gas
	}

	// 增加 20% Gas Limit
	gasLimit = gasLimit * 120 / 100

	chainID := new(big.Int).SetUint64(job.ChainID)
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonceVal,
		GasTipCap: gasPrice,
		GasFeeCap: new(big.Int).Mul(gasPrice, big.NewInt(2)),
		Gas:       gasLimit,
		To:        &tokenAddr,
		Value:     big.NewInt(0),
		Data:      data,
	})

	return tx, nil
}

// signTransaction 签名交易
// 注意：生产环境应使用 HSM/KMS，这里只是示例
func (s *PayoutService) signTransaction(ctx context.Context, tx *types.Transaction, chainID uint64) (*types.Transaction, error) {
	// Debt Fixed: Loaded from Config (formerly TODO)
	// Note: For High-Value Production, recommend switching to AWS KMS or Fireblocks via an interface here.
	privateKeyHex := s.cfg.PrivateKey // Now loaded from PAYOUT_PRIVATE_KEY env

	if privateKeyHex == "" {
		return nil, fmt.Errorf("critical: payment processing private key is missing")
	}

	// Sanitize hex string
	if len(privateKeyHex) > 2 && privateKeyHex[:2] == "0x" {
		privateKeyHex = privateKeyHex[2:]
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key configuration: %w", err)
	}

	signer := types.LatestSignerForChainID(new(big.Int).SetUint64(chainID))
	signedTx, err := types.SignTx(tx, signer, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign: %w", err)
	}

	return signedTx, nil
}

// validateRequest 验证请求
func (s *PayoutService) validateRequest(req *BatchPayoutRequest) error {
	if req.BatchID == "" {
		return fmt.Errorf("batch_id is required")
	}
	if req.UserID == "" {
		return fmt.Errorf("user_id is required")
	}
	if req.FromAddress == "" {
		return fmt.Errorf("from_address is required")
	}
	if len(req.Items) == 0 {
		return fmt.Errorf("at least one item is required")
	}
	_, evmOk := s.clients[req.ChainID]
	_, tronOk := s.tronClients[req.ChainID]
	if !evmOk && !tronOk {
		return fmt.Errorf("unsupported chain_id: %d", req.ChainID)
	}

	for i, item := range req.Items {
		if item.RecipientAddress == "" {
			return fmt.Errorf("item[%d]: recipient_address is required", i)
		}
		if item.Amount == "" {
			return fmt.Errorf("item[%d]: amount is required", i)
		}
		// Validate address format based on chain type
		if tronOk {
			if !isTronAddress(item.RecipientAddress) {
				return fmt.Errorf("item[%d]: invalid TRON recipient_address (expected Base58 starting with 'T')", i)
			}
		} else {
			if !common.IsHexAddress(item.RecipientAddress) {
				return fmt.Errorf("item[%d]: invalid EVM recipient_address", i)
			}
		}
	}

	return nil
}

// isTronAddress validates a TRON Base58Check address format.
// Valid: starts with 'T', 34 characters, Base58 alphabet only.
func isTronAddress(address string) bool {
	if len(address) != 34 {
		return false
	}
	if address[0] != 'T' {
		return false
	}
	// Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
	const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	for _, c := range address {
		if !strings.ContainsRune(base58Chars, c) {
			return false
		}
	}
	return true
}

// processTronJob handles TRX native and TRC20 token transfers on the TRON network.
// Flow: validate → build tx → sign → broadcast → return tx hash.
func (s *PayoutService) processTronJob(ctx context.Context, client *tronclient.GrpcClient, job *queue.Job) (*queue.JobResult, error) {
	log.Info().
		Str("job_id", job.ID).
		Str("to", job.ToAddress).
		Str("amount", job.Amount).
		Str("token", job.TokenSymbol).
		Str("token_address", job.TokenAddress).
		Msg("Processing TRON payout job")

	if client == nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("TRON client is nil for chain %d", job.ChainID),
		}, nil
	}

	// Resolve TRON private key (prefer dedicated key, fallback to shared)
	privateKeyHex := s.cfg.TronPrivateKey
	if privateKeyHex == "" {
		privateKeyHex = s.cfg.PrivateKey
	}
	if privateKeyHex == "" {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("critical: TRON private key not configured (set TRON_PRIVATE_KEY or PAYOUT_PRIVATE_KEY)"),
		}, nil
	}

	// Parse and validate amount
	amount, ok := new(big.Int).SetString(job.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("invalid TRON transfer amount: %s", job.Amount),
		}, nil
	}

	// Build transaction: native TRX or TRC20
	var txExt *tronapi.TransactionExtention
	var err error

	if job.TokenAddress == "" {
		// Native TRX transfer (amount is in SUN: 1 TRX = 1,000,000 SUN)
		txExt, err = client.Transfer(job.FromAddress, job.ToAddress, amount.Int64())
	} else {
		// TRC20 token transfer (e.g. USDT, USDC)
		feeLimit := s.cfg.TRC20FeeLimit
		if feeLimit <= 0 {
			feeLimit = 100_000_000 // 100 TRX default
		}
		txExt, err = client.TRC20Send(job.FromAddress, job.ToAddress, job.TokenAddress, amount, feeLimit)
	}
	if err != nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to build TRON transaction: %w", err),
		}, nil
	}

	// Validate the node returned a valid transaction
	if txExt == nil || txExt.GetTransaction() == nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("TRON node returned nil transaction"),
		}, nil
	}
	if txExt.GetResult() != nil && txExt.GetResult().GetCode() != tronapi.Return_SUCCESS {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("TRON node rejected transaction: %s", string(txExt.GetResult().GetMessage())),
		}, nil
	}

	// Sign the transaction
	signedTx, err := s.signTronTransaction(txExt.GetTransaction(), txExt.GetTxid(), privateKeyHex)
	if err != nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to sign TRON transaction: %w", err),
		}, nil
	}

	// Broadcast to the TRON network
	broadcastResult, err := client.Broadcast(signedTx)
	if err != nil {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("failed to broadcast TRON transaction: %w", err),
		}, nil
	}

	// Check broadcast result
	if !broadcastResult.GetResult() {
		return &queue.JobResult{
			JobID:   job.ID,
			Success: false,
			Error:   fmt.Errorf("TRON broadcast rejected (code=%v): %s", broadcastResult.GetCode(), string(broadcastResult.GetMessage())),
		}, nil
	}

	// Extract transaction hash
	txHash := hex.EncodeToString(txExt.GetTxid())
	log.Info().
		Str("job_id", job.ID).
		Str("tx_hash", txHash).
		Str("to", job.ToAddress).
		Str("token", job.TokenSymbol).
		Msg("TRON transaction broadcast successfully")

	return &queue.JobResult{
		JobID:   job.ID,
		Success: true,
		TxHash:  txHash,
	}, nil
}

// signTronTransaction signs a TRON transaction using ECDSA (secp256k1).
// TRON uses SHA256(raw_data) as the signing hash, same curve as Ethereum.
func (s *PayoutService) signTronTransaction(tx *troncore.Transaction, txID []byte, privateKeyHex string) (*troncore.Transaction, error) {
	// Sanitize hex prefix
	if len(privateKeyHex) > 2 && privateKeyHex[:2] == "0x" {
		privateKeyHex = privateKeyHex[2:]
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid TRON private key: %w", err)
	}

	// Determine the hash to sign:
	// If the node provided txID (SHA256 of raw_data), use it directly.
	// Otherwise, compute it ourselves.
	var hash []byte
	if len(txID) == 32 {
		hash = txID
	} else {
		rawData, err := proto.Marshal(tx.GetRawData())
		if err != nil {
			return nil, fmt.Errorf("failed to marshal transaction raw data: %w", err)
		}
		h := sha256.Sum256(rawData)
		hash = h[:]
	}

	// Sign with ECDSA (TRON uses same secp256k1 as Ethereum)
	signature, err := crypto.Sign(hash, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign TRON transaction: %w", err)
	}

	tx.Signature = append(tx.Signature, signature)
	return tx, nil
}

// waitForTronConfirmation polls the TRON node for transaction confirmation.
// Returns nil if confirmed, error on timeout or failure.
func (s *PayoutService) waitForTronConfirmation(ctx context.Context, client *tronclient.GrpcClient, txHash string, timeout time.Duration) error {
	deadline := time.After(timeout)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			// Not necessarily an error — tx may confirm later via event-indexer
			log.Warn().Str("tx_hash", txHash).Msg("TRON confirmation polling timed out")
			return nil
		case <-ticker.C:
			info, err := client.GetTransactionInfoByID(txHash)
			if err != nil {
				log.Debug().Err(err).Str("tx_hash", txHash).Msg("Waiting for TRON confirmation...")
				continue
			}
			if info != nil && info.GetBlockNumber() > 0 {
				log.Info().
					Str("tx_hash", txHash).
					Int64("block", info.GetBlockNumber()).
					Msg("TRON transaction confirmed")
				return nil
			}
		}
	}
}

// 请求/响应类型
type BatchPayoutRequest struct {
	BatchID     string
	UserID      string
	FromAddress string
	ChainID     uint64
	Items       []PayoutItem
}

type PayoutItem struct {
	ID               string
	RecipientAddress string
	Amount           string
	TokenAddress     string
	TokenSymbol      string
	TokenDecimals    uint32
}

type BatchPayoutResponse struct {
	BatchID string
	Status  BatchStatus
	Message string
}

type BatchStatus string

const (
	BatchStatusQueued     BatchStatus = "queued"
	BatchStatusProcessing BatchStatus = "processing"
	BatchStatusCompleted  BatchStatus = "completed"
	BatchStatusFailed     BatchStatus = "failed"
)
