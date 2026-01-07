package watcher

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/protocol-bank/event-indexer/internal/config"
	"github.com/rs/zerolog/log"
)

// ERC20 Transfer event signature
var transferEventSig = common.HexToHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")

// ERC20 ABI for decoding
const erc20ABI = `[{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]`

// ChainEvent 链上事件
type ChainEvent struct {
	ChainID      uint64
	ChainName    string
	EventType    string
	TxHash       string
	BlockNumber  uint64
	FromAddress  string
	ToAddress    string
	Value        string
	TokenAddress string
	TokenSymbol  string
	Timestamp    time.Time
	Confirmed    bool
}

// EventHandler 事件处理回调
type EventHandler func(event *ChainEvent)

// ChainWatcher 单链监听器
type ChainWatcher struct {
	chainID   uint64
	chainName string
	client    *ethclient.Client
	wsClient  *ethclient.Client
	cfg       config.ChainConfig
	addresses map[common.Address]bool
	handlers  []EventHandler
	erc20ABI  abi.ABI
	mu        sync.RWMutex
}

// MultiChainWatcher 多链监听器
type MultiChainWatcher struct {
	watchers map[uint64]*ChainWatcher
	handlers []EventHandler
}

// NewMultiChainWatcher 创建多链监听器
func NewMultiChainWatcher(ctx context.Context, cfg *config.Config) (*MultiChainWatcher, error) {
	mcw := &MultiChainWatcher{
		watchers: make(map[uint64]*ChainWatcher),
		handlers: []EventHandler{},
	}

	// 解析 ERC20 ABI
	parsedABI, err := abi.JSON(strings.NewReader(erc20ABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ERC20 ABI: %w", err)
	}

	// 为每条链创建监听器
	for chainID, chainCfg := range cfg.Chains {
		watcher, err := newChainWatcher(ctx, chainCfg, parsedABI)
		if err != nil {
			log.Warn().Err(err).Uint64("chain_id", chainID).Msg("Failed to create watcher, skipping")
			continue
		}

		// 添加监听地址
		for _, addr := range cfg.WatchedAddresses {
			watcher.AddAddress(common.HexToAddress(addr))
		}

		mcw.watchers[chainID] = watcher
		log.Info().Uint64("chain_id", chainID).Str("name", chainCfg.Name).Msg("Chain watcher created")
	}

	return mcw, nil
}

// newChainWatcher 创建单链监听器
func newChainWatcher(ctx context.Context, cfg config.ChainConfig, parsedABI abi.ABI) (*ChainWatcher, error) {
	// HTTP 客户端
	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	// WebSocket 客户端 (可选)
	var wsClient *ethclient.Client
	if cfg.WSURL != "" {
		wsClient, err = ethclient.Dial(cfg.WSURL)
		if err != nil {
			log.Warn().Err(err).Str("chain", cfg.Name).Msg("Failed to connect to WebSocket, using polling")
		}
	}

	return &ChainWatcher{
		chainID:   cfg.ChainID,
		chainName: cfg.Name,
		client:    client,
		wsClient:  wsClient,
		cfg:       cfg,
		addresses: make(map[common.Address]bool),
		handlers:  []EventHandler{},
		erc20ABI:  parsedABI,
	}, nil
}

// AddAddress 添加监听地址
func (w *ChainWatcher) AddAddress(addr common.Address) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.addresses[addr] = true
	log.Info().Str("address", addr.Hex()).Str("chain", w.chainName).Msg("Address added to watch list")
}

// RemoveAddress 移除监听地址
func (w *ChainWatcher) RemoveAddress(addr common.Address) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.addresses, addr)
}

// Start 启动多链监听
func (mcw *MultiChainWatcher) Start(ctx context.Context) {
	var wg sync.WaitGroup

	for chainID, watcher := range mcw.watchers {
		wg.Add(1)
		go func(cID uint64, w *ChainWatcher) {
			defer wg.Done()
			w.Start(ctx)
		}(chainID, watcher)
	}

	wg.Wait()
}

// AddHandler 添加事件处理器
func (mcw *MultiChainWatcher) AddHandler(handler EventHandler) {
	mcw.handlers = append(mcw.handlers, handler)
	for _, watcher := range mcw.watchers {
		watcher.handlers = append(watcher.handlers, handler)
	}
}

// Start 启动单链监听
func (w *ChainWatcher) Start(ctx context.Context) {
	log.Info().Str("chain", w.chainName).Msg("Starting chain watcher")

	// 优先使用 WebSocket 订阅
	if w.wsClient != nil {
		go w.subscribeNewBlocks(ctx)
	}

	// 同时使用轮询作为备份
	go w.pollBlocks(ctx)
}

// subscribeNewBlocks WebSocket 订阅新块
func (w *ChainWatcher) subscribeNewBlocks(ctx context.Context) {
	headers := make(chan *types.Header)
	sub, err := w.wsClient.SubscribeNewHead(ctx, headers)
	if err != nil {
		log.Error().Err(err).Str("chain", w.chainName).Msg("Failed to subscribe to new blocks")
		return
	}
	defer sub.Unsubscribe()

	log.Info().Str("chain", w.chainName).Msg("WebSocket subscription started")

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-sub.Err():
			log.Error().Err(err).Str("chain", w.chainName).Msg("WebSocket subscription error")
			return
		case header := <-headers:
			w.processBlock(ctx, header.Number.Uint64())
		}
	}
}

// pollBlocks 轮询新块
func (w *ChainWatcher) pollBlocks(ctx context.Context) {
	ticker := time.NewTicker(12 * time.Second) // 每 12 秒检查一次
	defer ticker.Stop()

	var lastBlock uint64

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			currentBlock, err := w.client.BlockNumber(ctx)
			if err != nil {
				log.Error().Err(err).Str("chain", w.chainName).Msg("Failed to get block number")
				continue
			}

			if lastBlock == 0 {
				lastBlock = currentBlock
				continue
			}

			// 处理新块
			for block := lastBlock + 1; block <= currentBlock; block++ {
				w.processBlock(ctx, block)
			}
			lastBlock = currentBlock
		}
	}
}

// processBlock 处理单个区块
func (w *ChainWatcher) processBlock(ctx context.Context, blockNumber uint64) {
	w.mu.RLock()
	addresses := make([]common.Address, 0, len(w.addresses))
	for addr := range w.addresses {
		addresses = append(addresses, addr)
	}
	w.mu.RUnlock()

	if len(addresses) == 0 {
		return
	}

	// 查询与监听地址相关的日志
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(blockNumber)),
		ToBlock:   big.NewInt(int64(blockNumber)),
		Topics:    [][]common.Hash{{transferEventSig}},
	}

	logs, err := w.client.FilterLogs(ctx, query)
	if err != nil {
		log.Error().Err(err).Uint64("block", blockNumber).Str("chain", w.chainName).Msg("Failed to filter logs")
		return
	}

	// 处理每个日志
	for _, vLog := range logs {
		w.processLog(ctx, vLog, addresses, blockNumber)
	}
}

// processLog 处理单个日志
func (w *ChainWatcher) processLog(ctx context.Context, vLog types.Log, addresses []common.Address, currentBlock uint64) {
	// 解析 Transfer 事件
	if len(vLog.Topics) < 3 {
		return
	}

	from := common.HexToAddress(vLog.Topics[1].Hex())
	to := common.HexToAddress(vLog.Topics[2].Hex())

	// 检查是否与监听地址相关
	isRelevant := false
	for _, addr := range addresses {
		if from == addr || to == addr {
			isRelevant = true
			break
		}
	}
	if !isRelevant {
		return
	}

	// 解析金额
	value := new(big.Int).SetBytes(vLog.Data)

	// 检查确认数
	confirmations := currentBlock - vLog.BlockNumber
	confirmed := confirmations >= w.cfg.Confirmations

	event := &ChainEvent{
		ChainID:      w.chainID,
		ChainName:    w.chainName,
		EventType:    "transfer",
		TxHash:       vLog.TxHash.Hex(),
		BlockNumber:  vLog.BlockNumber,
		FromAddress:  from.Hex(),
		ToAddress:    to.Hex(),
		Value:        value.String(),
		TokenAddress: vLog.Address.Hex(),
		Timestamp:    time.Now(),
		Confirmed:    confirmed,
	}

	log.Info().
		Str("chain", w.chainName).
		Str("tx", vLog.TxHash.Hex()).
		Str("from", from.Hex()).
		Str("to", to.Hex()).
		Str("value", value.String()).
		Bool("confirmed", confirmed).
		Msg("Transfer event detected")

	// 调用处理器
	for _, handler := range w.handlers {
		go handler(event)
	}
}
