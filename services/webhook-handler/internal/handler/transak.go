package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"github.com/protocol-bank/webhook-handler/internal/config"
	"github.com/protocol-bank/webhook-handler/internal/store"
	"github.com/rs/zerolog/log"
)

// TransakWebhookPayload Transak Webhook 负载
type TransakWebhookPayload struct {
	WebhookID string       `json:"webhookId"`
	EventType string       `json:"eventType"`
	Data      TransakOrder `json:"data"`
}

// TransakOrder Transak 订单
type TransakOrder struct {
	OrderID        string  `json:"id"`
	Status         string  `json:"status"`
	FiatCurrency   string  `json:"fiatCurrency"`
	FiatAmount     float64 `json:"fiatAmount"`
	CryptoCurrency string  `json:"cryptoCurrency"`
	CryptoAmount   float64 `json:"cryptoAmount"`
	WalletAddress  string  `json:"walletAddress"`
	Network        string  `json:"network"`
	TxHash         string  `json:"transactionHash"`
	CreatedAt      string  `json:"createdAt"`
	CompletedAt    string  `json:"completedAt"`
}

// TransakHandler Transak Webhook 处理器
type TransakHandler struct {
	cfg   config.TransakConfig
	store *store.WebhookStore
}

// NewTransakHandler 创建 Transak 处理器
func NewTransakHandler(cfg config.TransakConfig, store *store.WebhookStore) *TransakHandler {
	return &TransakHandler{
		cfg:   cfg,
		store: store,
	}
}

// HandleWebhook 处理 Transak Webhook
func (h *TransakHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to read request body")
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 验证签名
	signature := r.Header.Get("X-Transak-Signature")
	if !h.verifySignature(body, signature) {
		log.Warn().Str("signature", signature).Msg("Invalid Transak webhook signature")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload TransakWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Error().Err(err).Msg("Failed to parse webhook payload")
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 检查重复
	processed, err := h.store.IsProcessed(r.Context(), payload.WebhookID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check duplicate")
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if processed {
		log.Info().Str("webhook_id", payload.WebhookID).Msg("Duplicate webhook")
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Info().
		Str("webhook_id", payload.WebhookID).
		Str("event_type", payload.EventType).
		Str("order_id", payload.Data.OrderID).
		Msg("Processing Transak webhook")

	switch payload.EventType {
	case "ORDER_COMPLETED":
		h.handleOrderCompleted(r.Context(), payload.Data)
	case "ORDER_PROCESSING":
		h.handleOrderProcessing(r.Context(), payload.Data)
	case "ORDER_FAILED":
		h.handleOrderFailed(r.Context(), payload.Data)
	case "ORDER_CANCELLED":
		h.handleOrderCancelled(r.Context(), payload.Data)
	default:
		log.Warn().Str("event_type", payload.EventType).Msg("Unknown Transak event type")
	}

	if err := h.store.MarkProcessed(r.Context(), payload.WebhookID, string(body)); err != nil {
		log.Error().Err(err).Msg("Failed to mark as processed")
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// verifySignature 验证签名
func (h *TransakHandler) verifySignature(body []byte, signature string) bool {
	if h.cfg.WebhookSecret == "" {
		return true
	}

	mac := hmac.New(sha256.New, []byte(h.cfg.WebhookSecret))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSig))
}

func (h *TransakHandler) handleOrderCompleted(ctx interface{}, order TransakOrder) {
	log.Info().
		Str("order_id", order.OrderID).
		Float64("fiat_amount", order.FiatAmount).
		Float64("crypto_amount", order.CryptoAmount).
		Str("wallet", order.WalletAddress).
		Str("tx_hash", order.TxHash).
		Msg("Transak order completed")
	// TODO: 更新用户购买记录
}

func (h *TransakHandler) handleOrderProcessing(ctx interface{}, order TransakOrder) {
	log.Info().Str("order_id", order.OrderID).Msg("Transak order processing")
}

func (h *TransakHandler) handleOrderFailed(ctx interface{}, order TransakOrder) {
	log.Warn().Str("order_id", order.OrderID).Msg("Transak order failed")
}

func (h *TransakHandler) handleOrderCancelled(ctx interface{}, order TransakOrder) {
	log.Info().Str("order_id", order.OrderID).Msg("Transak order cancelled")
}
