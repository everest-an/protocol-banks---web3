package service

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/protocol-bank/payout-engine/internal/config"
	"github.com/protocol-bank/payout-engine/internal/kms"
	"github.com/protocol-bank/payout-engine/internal/nonce"
	"github.com/protocol-bank/payout-engine/internal/queue"
	"github.com/rs/zerolog/log"
)

// ERC20 ABI (只需要 transfer 函数)
const erc20ABI = `[{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"}]`

// PayoutService 支付服务
type PayoutService struct {
	cfg          *config.Config
	nonceManager *nonce.Manager
	queue        *queue.Consumer
	clients      map[uint64]*ethclient.Client
	erc20ABI     abi.ABI
	signer       kms.Signer
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

	// 初始化 KMS 签名器
	kmsCfg := &kms.Config{
		Provider:        kms.Provider(cfg.KMS.Provider),
		LocalPrivateKey: cfg.KMS.LocalPrivateKey,
		AWSRegion:       cfg.KMS.AWSRegion,
		AWSKeyID:        cfg.KMS.AWSKeyID,
		GCPProjectID:    cfg.KMS.GCPProjectID,
		GCPLocationID:   cfg.KMS.GCPLocationID,
		GCPKeyRingID:    cfg.KMS.GCPKeyRingID,
		GCPKeyID:        cfg.KMS.GCPKeyID,
		GCPKeyVersion:   cfg.KMS.GCPKeyVersion,
		VaultAddress:    cfg.KMS.VaultAddress,
		VaultToken:      cfg.KMS.VaultToken,
		VaultMountPath:  cfg.KMS.VaultMountPath,
		VaultKeyName:    cfg.KMS.VaultKeyName,
	}

	signer, err := kms.NewSigner(ctx, kmsCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize KMS signer: %w", err)
	}

	signerAddr, err := signer.GetAddress(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get signer address: %w", err)
	}
	log.Info().Str("address", signerAddr.Hex()).Str("provider", cfg.KMS.Provider).Msg("KMS signer initialized")

	// 初始化链客户端
	clients := make(map[uint64]*ethclient.Client)
	for chainID, chainCfg := range cfg.Chains {
		client, err := ethclient.Dial(chainCfg.RPCURL)
		if err != nil {
			log.Warn().Err(err).Uint64("chain_id", chainID).Msg("Failed to connect to chain")
			continue
		}
		clients[chainID] = client
		nonceManager.AddChainClient(chainID, client)
		log.Info().Uint64("chain_id", chainID).Str("name", chainCfg.Name).Msg("Connected to chain")
	}

	return &PayoutService{
		cfg:          cfg,
		nonceManager: nonceManager,
		queue:        queueConsumer,
		clients:      clients,
		erc20ABI:     parsedABI,
		signer:       signer,
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

// signTransaction 使用 KMS 签名交易
func (s *PayoutService) signTransaction(ctx context.Context, tx *types.Transaction, chainID uint64) (*types.Transaction, error) {
	if s.signer == nil {
		return nil, fmt.Errorf("KMS signer not initialized")
	}

	chainIDBig := new(big.Int).SetUint64(chainID)
	signedTx, err := s.signer.SignTransaction(ctx, tx, chainIDBig)
	if err != nil {
		return nil, fmt.Errorf("KMS signing failed: %w", err)
	}

	return signedTx, nil
}

// Close 释放资源
func (s *PayoutService) Close() error {
	if s.signer != nil {
		return s.signer.Close()
	}
	return nil
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
	if _, ok := s.clients[req.ChainID]; !ok {
		return fmt.Errorf("unsupported chain_id: %d", req.ChainID)
	}

	for i, item := range req.Items {
		if item.RecipientAddress == "" {
			return fmt.Errorf("item[%d]: recipient_address is required", i)
		}
		if item.Amount == "" {
			return fmt.Errorf("item[%d]: amount is required", i)
		}
		if !common.IsHexAddress(item.RecipientAddress) {
			return fmt.Errorf("item[%d]: invalid recipient_address", i)
		}
	}

	return nil
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
