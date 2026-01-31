package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
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
	realCtx, ok := ctx.(context.Context)
	if !ok {
		log.Error().Msg("Invalid context type for transaction handler")
		return
	}

	var tx RainTransaction
	if err := json.Unmarshal(payload.Data, &tx); err != nil {
		log.Error().Err(err).Msg("Failed to parse transaction data")
		return
	}

	// 保存交易记录到数据库
	if err := h.store.SaveRainTransaction(realCtx, tx.TransactionID, tx.CardID, tx.UserID,
		tx.MerchantName, tx.MerchantCategory, tx.Amount, tx.Currency, tx.Status); err != nil {
		log.Error().Err(err).Str("tx_id", tx.TransactionID).Msg("Failed to save transaction")
		return
	}

	// 创建用户通知
	notifMsg := fmt.Sprintf("%.2f %s at %s", tx.Amount, tx.Currency, tx.MerchantName)
	if err := h.store.CreateNotification(realCtx, tx.UserID, "card_transaction",
		"Card Transaction", notifMsg); err != nil {
		log.Error().Err(err).Msg("Failed to create transaction notification")
	}

	log.Info().
		Str("tx_id", tx.TransactionID).
		Str("merchant", tx.MerchantName).
		Float64("amount", tx.Amount).
		Str("status", tx.Status).
		Msg("Card transaction processed and saved")
}

// handleCardCreated 处理卡片创建事件
func (h *RainHandler) handleCardCreated(ctx interface{}, payload RainWebhookPayload) {
	realCtx, ok := ctx.(context.Context)
	if !ok {
		log.Error().Msg("Invalid context type for card created handler")
		return
	}

	var cardData struct {
		CardID        string `json:"card_id"`
		UserID        string `json:"user_id"`
		WalletAddress string `json:"wallet_address"`
		Last4         string `json:"last_4"`
	}
	if err := json.Unmarshal(payload.Data, &cardData); err != nil {
		log.Error().Err(err).Msg("Failed to parse card created data")
		return
	}

	if err := h.store.UpdateCardStatus(realCtx, cardData.CardID, "created"); err != nil {
		log.Error().Err(err).Str("card_id", cardData.CardID).Msg("Failed to update card status")
		return
	}

	log.Info().Str("event_id", payload.EventID).Str("card_id", cardData.CardID).Msg("Card created and status updated")
}

// handleCardActivated 处理卡片激活事件
func (h *RainHandler) handleCardActivated(ctx interface{}, payload RainWebhookPayload) {
	realCtx, ok := ctx.(context.Context)
	if !ok {
		log.Error().Msg("Invalid context type for card activated handler")
		return
	}

	var cardData struct {
		CardID string `json:"card_id"`
		UserID string `json:"user_id"`
	}
	if err := json.Unmarshal(payload.Data, &cardData); err != nil {
		log.Error().Err(err).Msg("Failed to parse card activated data")
		return
	}

	if err := h.store.UpdateCardStatus(realCtx, cardData.CardID, "active"); err != nil {
		log.Error().Err(err).Str("card_id", cardData.CardID).Msg("Failed to activate card")
		return
	}

	// 通知用户卡片已激活
	if err := h.store.CreateNotification(realCtx, cardData.UserID, "card_activated",
		"Card Activated", "Your Rain card has been activated and is ready to use."); err != nil {
		log.Error().Err(err).Msg("Failed to create card activation notification")
	}

	log.Info().Str("event_id", payload.EventID).Str("card_id", cardData.CardID).Msg("Card activated and status updated")
}

// handleSettlement 处理结算事件
func (h *RainHandler) handleSettlement(ctx interface{}, payload RainWebhookPayload) {
	realCtx, ok := ctx.(context.Context)
	if !ok {
		log.Error().Msg("Invalid context type for settlement handler")
		return
	}

	var settlement struct {
		SettlementID string  `json:"settlement_id"`
		CardID       string  `json:"card_id"`
		UserID       string  `json:"user_id"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
	}
	if err := json.Unmarshal(payload.Data, &settlement); err != nil {
		log.Error().Err(err).Msg("Failed to parse settlement data")
		return
	}

	// 记录结算并更新余额
	if err := h.store.ProcessSettlement(realCtx, settlement.SettlementID, settlement.CardID,
		settlement.UserID, settlement.Amount, settlement.Currency); err != nil {
		log.Error().Err(err).Str("settlement_id", settlement.SettlementID).Msg("Failed to process settlement")
		return
	}

	log.Info().
		Str("event_id", payload.EventID).
		Str("settlement_id", settlement.SettlementID).
		Float64("amount", settlement.Amount).
		Msg("Settlement processed and balance updated")
}

// checkAuthorization 检查授权
func (h *RainHandler) checkAuthorization(ctx interface{}, req RainAuthorizationRequest) (bool, string) {
	// 转换 context
	realCtx, ok := ctx.(context.Context)
	if !ok {
		log.Error().Msg("Invalid context type for authorization check")
		return false, "internal_error"
	}

	// 使用带超时的 context（授权请求通常需要快速响应）
	checkCtx, cancel := context.WithTimeout(realCtx, 5*time.Second)
	defer cancel()

	// 1. 获取卡用户信息
	userInfo, err := h.store.GetCardUserInfo(checkCtx, req.CardID)
	if err != nil {
		log.Error().Err(err).Str("card_id", req.CardID).Msg("Failed to get card user info")
		// 查询失败时拒绝交易（安全优先）
		h.recordAuthorizationResult(checkCtx, req, false, "card_not_found")
		return false, "card_not_found"
	}

	// 2. 检查卡是否激活
	if !userInfo.IsActive {
		log.Warn().Str("card_id", req.CardID).Msg("Card is not active")
		h.recordAuthorizationResult(checkCtx, req, false, "card_inactive")
		return false, "card_inactive"
	}

	// 3. 检查余额是否充足
	if userInfo.Balance < req.Amount {
		log.Warn().
			Str("card_id", req.CardID).
			Float64("balance", userInfo.Balance).
			Float64("amount", req.Amount).
			Msg("Insufficient balance")
		h.recordAuthorizationResult(checkCtx, req, false, "insufficient_balance")
		return false, "insufficient_balance"
	}

	// 4. 检查单笔交易限额
	if req.Amount > userInfo.SingleTxLimit {
		log.Warn().
			Str("card_id", req.CardID).
			Float64("amount", req.Amount).
			Float64("limit", userInfo.SingleTxLimit).
			Msg("Single transaction limit exceeded")
		h.recordAuthorizationResult(checkCtx, req, false, "single_tx_limit_exceeded")
		return false, "single_tx_limit_exceeded"
	}

	// 5. 检查日限额
	if userInfo.DailySpent+req.Amount > userInfo.DailyLimit {
		log.Warn().
			Str("card_id", req.CardID).
			Float64("daily_spent", userInfo.DailySpent).
			Float64("amount", req.Amount).
			Float64("limit", userInfo.DailyLimit).
			Msg("Daily limit exceeded")
		h.recordAuthorizationResult(checkCtx, req, false, "daily_limit_exceeded")
		return false, "daily_limit_exceeded"
	}

	// 6. 检查月限额
	if userInfo.MonthlySpent+req.Amount > userInfo.MonthlyLimit {
		log.Warn().
			Str("card_id", req.CardID).
			Float64("monthly_spent", userInfo.MonthlySpent).
			Float64("amount", req.Amount).
			Float64("limit", userInfo.MonthlyLimit).
			Msg("Monthly limit exceeded")
		h.recordAuthorizationResult(checkCtx, req, false, "monthly_limit_exceeded")
		return false, "monthly_limit_exceeded"
	}

	// 7. 检查商户黑名单
	isBlacklisted, err := h.store.IsMerchantBlacklisted(checkCtx, req.MerchantName, "")
	if err != nil {
		log.Error().Err(err).Str("merchant", req.MerchantName).Msg("Failed to check merchant blacklist")
		// 查询失败时拒绝交易（安全优先）
		h.recordAuthorizationResult(checkCtx, req, false, "blacklist_check_failed")
		return false, "blacklist_check_failed"
	}
	if isBlacklisted {
		log.Warn().Str("merchant", req.MerchantName).Msg("Merchant is blacklisted")
		h.recordAuthorizationResult(checkCtx, req, false, "merchant_blacklisted")
		return false, "merchant_blacklisted"
	}

	// 所有检查通过，批准交易
	log.Info().
		Str("card_id", req.CardID).
		Str("user_id", req.UserID).
		Float64("amount", req.Amount).
		Str("merchant", req.MerchantName).
		Msg("Authorization approved")

	h.recordAuthorizationResult(checkCtx, req, true, "approved")
	return true, "approved"
}

// recordAuthorizationResult 记录授权结果
func (h *RainHandler) recordAuthorizationResult(ctx context.Context, req RainAuthorizationRequest, approved bool, reason string) {
	if err := h.store.RecordAuthorization(ctx, req.AuthorizationID, req.CardID, req.UserID, req.MerchantName, req.Amount, approved, reason); err != nil {
		log.Error().Err(err).Str("auth_id", req.AuthorizationID).Msg("Failed to record authorization")
	}
}
