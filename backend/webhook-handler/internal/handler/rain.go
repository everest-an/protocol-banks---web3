package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/protocol-bank/webhook-handler/internal/config"
	"github.com/protocol-bank/webhook-handler/internal/store"
	"github.com/rs/zerolog/log"
)

// RainWebhookPayload Rain 卡 Webhook 负载
type RainWebhookPayload struct {
	EventID   string          `json:"event_id"`
	EventType string          `json:"event_type"`
	Timestamp int64           `json:"timestamp"`
	Data      json.RawMessage `json:"data"`
}

// RainTransaction Rain 交易数据
type RainTransaction struct {
	TransactionID    string  `json:"transaction_id"`
	CardID           string  `json:"card_id"`
	UserID           string  `json:"user_id"`
	MerchantName     string  `json:"merchant_name"`
	MerchantCategory string  `json:"merchant_category_code"`
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	Status           string  `json:"status"`
	CreatedAt        string  `json:"created_at"`
}

// RainAuthorizationRequest Rain 授权请求
type RainAuthorizationRequest struct {
	AuthorizationID string  `json:"authorization_id"`
	CardID          string  `json:"card_id"`
	UserID          string  `json:"user_id"`
	MerchantName    string  `json:"merchant_name"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
}

// RainHandler Rain Webhook 处理器
type RainHandler struct {
	cfg   config.RainConfig
	store *store.WebhookStore
}

// NewRainHandler 创建 Rain 处理器
func NewRainHandler(cfg config.RainConfig, store *store.WebhookStore) *RainHandler {
	return &RainHandler{
		cfg:   cfg,
		store: store,
	}
}

// HandleWebhook 处理 Rain Webhook
func (h *RainHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// 读取请求体
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to read request body")
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 验证签名
	signature := r.Header.Get("X-Rain-Signature")
	timestamp := r.Header.Get("X-Rain-Timestamp")
	if !h.verifySignature(body, signature, timestamp) {
		log.Warn().Str("signature", signature).Msg("Invalid webhook signature")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 防重放攻击检查
	ts, _ := strconv.ParseInt(timestamp, 10, 64)
	if time.Now().Unix()-ts > 300 { // 5 分钟过期
		log.Warn().Int64("timestamp", ts).Msg("Webhook timestamp expired")
		http.Error(w, "Request expired", http.StatusUnauthorized)
		return
	}

	// 解析负载
	var payload RainWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Error().Err(err).Msg("Failed to parse webhook payload")
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 检查重复处理
	processed, err := h.store.IsProcessed(r.Context(), payload.EventID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check duplicate")
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if processed {
		log.Info().Str("event_id", payload.EventID).Msg("Duplicate webhook, skipping")
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Info().
		Str("event_id", payload.EventID).
		Str("event_type", payload.EventType).
		Msg("Processing Rain webhook")

	// 根据事件类型处理
	switch payload.EventType {
	case "card.transaction":
		h.handleTransaction(r.Context(), payload)
	case "card.created":
		h.handleCardCreated(r.Context(), payload)
	case "card.activated":
		h.handleCardActivated(r.Context(), payload)
	case "card.settlement":
		h.handleSettlement(r.Context(), payload)
	default:
		log.Warn().Str("event_type", payload.EventType).Msg("Unknown event type")
	}

	// 标记为已处理
	if err := h.store.MarkProcessed(r.Context(), payload.EventID, string(body)); err != nil {
		log.Error().Err(err).Msg("Failed to mark as processed")
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// HandleAuthorizationRequest 处理实时授权请求
func (h *RainHandler) HandleAuthorizationRequest(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 验证签名
	signature := r.Header.Get("X-Rain-Signature")
	timestamp := r.Header.Get("X-Rain-Timestamp")
	if !h.verifySignature(body, signature, timestamp) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var authReq RainAuthorizationRequest
	if err := json.Unmarshal(body, &authReq); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	log.Info().
		Str("auth_id", authReq.AuthorizationID).
		Str("card_id", authReq.CardID).
		Float64("amount", authReq.Amount).
		Str("merchant", authReq.MerchantName).
		Msg("Processing authorization request")

	// 检查用户余额和限额
	approved, reason := h.checkAuthorization(r.Context(), authReq)

	// 返回授权决定
	response := map[string]interface{}{
		"authorization_id": authReq.AuthorizationID,
		"approved":         approved,
		"reason":           reason,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// verifySignature 验证 HMAC 签名
func (h *RainHandler) verifySignature(body []byte, signature, timestamp string) bool {
	if h.cfg.WebhookSecret == "" {
		return true // 开发环境跳过验证
	}

	// 构造签名消息
	message := timestamp + "." + string(body)

	// 计算 HMAC-SHA256
	mac := hmac.New(sha256.New, []byte(h.cfg.WebhookSecret))
	mac.Write([]byte(message))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSig))
}

// handleTransaction 处理交易事件
func (h *RainHandler) handleTransaction(ctx interface{}, payload RainWebhookPayload) {
	var tx RainTransaction
	if err := json.Unmarshal(payload.Data, &tx); err != nil {
		log.Error().Err(err).Msg("Failed to parse transaction data")
		return
	}

	log.Info().
		Str("tx_id", tx.TransactionID).
		Str("merchant", tx.MerchantName).
		Float64("amount", tx.Amount).
		Str("status", tx.Status).
		Msg("Card transaction processed")

	// TODO: 同步到数据库，触发通知等
}

// handleCardCreated 处理卡片创建事件
func (h *RainHandler) handleCardCreated(ctx interface{}, payload RainWebhookPayload) {
	log.Info().Str("event_id", payload.EventID).Msg("Card created event")
	// TODO: 更新用户卡片状态
}

// handleCardActivated 处理卡片激活事件
func (h *RainHandler) handleCardActivated(ctx interface{}, payload RainWebhookPayload) {
	log.Info().Str("event_id", payload.EventID).Msg("Card activated event")
	// TODO: 更新用户卡片状态
}

// handleSettlement 处理结算事件
func (h *RainHandler) handleSettlement(ctx interface{}, payload RainWebhookPayload) {
	log.Info().Str("event_id", payload.EventID).Msg("Settlement event")
	// TODO: 处理结算，更新用户余额
}

// checkAuthorization 检查授权
func (h *RainHandler) checkAuthorization(ctx interface{}, req RainAuthorizationRequest) (bool, string) {
	// TODO: 实现授权检查逻辑
	// 1. 检查用户余额
	// 2. 检查交易限额
	// 3. 检查黑名单商户
	return true, "approved"
}
