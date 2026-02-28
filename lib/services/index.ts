/**
 * Services Index
 * Central barrel export for all service modules.
 *
 * Organised by domain. Where two files export the same name,
 * an alias is applied so both remain reachable without ambiguity.
 * Consumers that need the exact un-aliased name should import directly
 * from the source file.
 *
 * Sub-directory modules (security/, yield/, queue/) are grouped at the end.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Validation & Address Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  isValidAddress,
  isValidChainAddress,
  normalizeAddress,
  isZeroAddress,
  validateAccountWalletAssociation,
  validateTransferAddresses,
  validateAddressBatch,
} from './account-validator.service'

export {
  MAX_BATCH_SIZE,
  MIN_AMOUNT,
  validateBatchItem,
  validateBatch,
  findDuplicateRecipients,
  calculateBatchTotals,
} from './batch-validator.service'

export type { BatchPaymentItem } from './batch-validator.service'

// vendor-service exports validateAddress — keep it accessible under its own alias
// (account-validator does NOT export a plain validateAddress, so no conflict there)
export {
  validateAddress as validateVendorAddress,
  validateVendorData,
  calculateNetworkStats,
  formatVendorForDisplay,
  groupVendorsByCategory,
} from './vendor-service'

// ─────────────────────────────────────────────────────────────────────────────
// EIP-712 / Authorization / Nonce / Validity-Window Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  DOMAIN_TYPE,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  buildDomain,
  buildTypedData,
  hashTypedData,
  recoverSigner,
  // verifySignature conflicts with multisig-service — export with alias
  verifySignature as eip712VerifySignature,
  splitSignature,
} from './eip712.service'

export {
  generateAuthorization,
  generateBatchAuthorizations,
  encodeTransferWithAuthorization,
  createPermitMessage,
} from './authorization-generator.service'

export {
  generateNonce,
  isNonceUsed,
  markNonceUsed,
  getNonceCount,
  incrementNonce,
  clearNonces,
  isValidNonce,
} from './nonce-manager.service'

export {
  DEFAULT_VALIDITY_DURATION,
  MAX_VALIDITY_DURATION,
  MIN_VALIDITY_DURATION,
  getCurrentTimestamp,
  createValidityWindow,
  isWithinValidityWindow,
  isExpired,
  isNotYetValid,
  getRemainingTime,
  validateValidityWindow,
  formatRemainingTime,
} from './validity-window.service'

export {
  verifyAuthorizationSignature,
  validateAuthorization,
  verifyBatchSignatures,
  isCompactSignature,
  normalizeSignature,
} from './signature-verifier.service'

// ─────────────────────────────────────────────────────────────────────────────
// Fee Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  DEFAULT_FEE_CONFIG,
  NETWORK_GAS_ESTIMATES,
  calculateFees,
  calculateBatchFees,
  getFeeTier,
  formatFee,
} from './fee-calculator.service'

export {
  estimateGas,
  calculateRelayerFee,
  calculateBatchRelayerFee,
  getEstimatedConfirmationTime,
  formatRelayerFee,
} from './x402-fee-calculator.service'

export {
  calculateDistribution,
  logFeeDistribution,
  getFeeStatistics,
  createFeeDistribution,
} from './fee-distributor.service'

// ─────────────────────────────────────────────────────────────────────────────
// File & Report Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  parseCsv,
  parseExcel,
  parseFile,
  parseBatchFile,
} from './file-parser.service'

export {
  generateBatchCsvReport,
  createBatchReport,
  downloadCsvReport,
  generateReportFilename,
  formatReportForEmail,
} from './report-generator.service'

// Re-export from lib for unified access
export { parsePaymentFile, generateSampleCSV, generateSampleExcel } from '@/lib/excel-parser'

// ─────────────────────────────────────────────────────────────────────────────
// Payment Processing Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  validateRecipients,
  calculateTotal,
  estimateFees,
  processSinglePayment,
  processBatchPayments,
  processEIP3009Payment,
  executeEIP3009Payment,
  formatPaymentForDisplay,
  validatePaymentData,
  processBatchPayment,
} from './payment-service'

export {
  checkIdempotency,
  completeIdempotency,
  failIdempotency,
  cleanExpiredKeys,
} from './idempotency-service'

export {
  executeBatch,
} from './batch-execution-worker'

export {
  createBatchItems,
  updateBatchItem,
  getBatchItems,
  getRetryableItems,
  // retryFailedItems conflicts with recovery-manager.service — export with alias
  retryFailedItems as retryBatchFailedItems,
  claimBatchItem,
} from './batch-item-service'

// ─────────────────────────────────────────────────────────────────────────────
// Batch Transfer Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  // TOKEN_ADDRESSES conflicts with public-batch-transfer-service — alias both
  TOKEN_ADDRESSES as BATCH_TRANSFER_TOKEN_ADDRESSES,
  BatchTransferService,
  batchTransferService,
} from './batch-transfer-service'

export {
  PUBLIC_BATCH_CONTRACTS,
  // TOKEN_ADDRESSES conflicts with batch-transfer-service — alias
  TOKEN_ADDRESSES as PUBLIC_BATCH_TOKEN_ADDRESSES,
  PublicBatchTransferService,
  publicBatchTransferService,
} from './public-batch-transfer-service'

// ─────────────────────────────────────────────────────────────────────────────
// Relayer Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  RelayerService,
  relayerService,
  executeGaslessUSDCTransfer,
  isRelayerConfigured,
  getSupportedRelayChains,
} from './relayer-service'

export {
  submitToRelayer,
  checkRelayerStatus,
  submitBatchToRelayer,
  getSupportedChains,
} from './relayer-client.service'

// ─────────────────────────────────────────────────────────────────────────────
// Recovery & Retry Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  calculateRetryDelay,
  shouldRetry,
  // retryFailedItems conflicts with batch-item-service — alias
  retryFailedItems as recoverFailedItems,
  createFailedItem,
  storeFailedItems,
  getPendingFailedItems,
} from './recovery-manager.service'

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Services
// ─────────────────────────────────────────────────────────────────────────────

// vendor-payment-service exports Vendor/VendorStats — namespace to avoid
// conflicts with the Vendor/VendorStats types defined in @/types
export {
  VendorPaymentService,
  vendorPaymentService,
} from './vendor-payment-service'

export type {
  Vendor as VendorRecord,
  VendorPayment,
  VendorStats as VendorPaymentStats,
} from './vendor-payment-service'

export {
  createVendorWithAddresses,
  getVendorWithAddresses,
  listVendorsWithAddresses,
  addVendorAddress,
  updateVendorAddress,
  deleteVendorAddress,
  getVendorAddressForNetwork,
  getVendorByAddress,
} from './vendor-multi-network.service'

export type {
  VendorAddress,
  VendorWithAddresses,
} from './vendor-multi-network.service'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  generateWebhookSecret,
  hashWebhookSecret,
  // generateWebhookSignature conflicts with agent-webhook-service — alias
  generateWebhookSignature as generateHmacWebhookSignature,
  verifyWebhookSignature,
  calculateNextRetryTime,
  WebhookService,
  webhookService,
} from './webhook-service'

export type {
  WebhookEvent,
  Webhook,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDelivery,
  WebhookPayload,
} from './webhook-service'

export {
  WebhookTriggerService,
  webhookTriggerService,
  processWebhookDeliveries,
} from './webhook-trigger-service'

export type {
  PaymentEventData,
  BatchPaymentEventData,
  MultisigEventData,
  SubscriptionEventData,
} from './webhook-trigger-service'

export {
  // setUseDatabaseStorage conflicts across multiple files — alias per domain
  setUseDatabaseStorage as setAgentWebhookUseDatabaseStorage,
  // generateWebhookSignature conflicts with webhook-service — alias
  generateWebhookSignature as generateAgentWebhookSignature,
  verifyAgentWebhookSignature,
  AgentWebhookService,
  agentWebhookService,
} from './agent-webhook-service'

export type {
  AgentWebhookEvent,
  AgentWebhookDelivery,
} from './agent-webhook-service'

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  NotificationService,
  notificationService,
} from './notification-service'

export type {
  PushSubscription,
  NotificationPreferences,
  NotificationPayload,
  NotificationType,
} from './notification-service'

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  isSubscriptionDue,
  SubscriptionService,
  subscriptionService,
} from './subscription-service'

export type {
  SubscriptionFrequency,
  SubscriptionStatus,
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from './subscription-service'

export {
  SubscriptionPaymentExecutor,
  subscriptionPaymentExecutor,
  processSubscriptionsCron,
} from './subscription-payment-executor'

export type {
  PaymentExecutionResult,
  PaymentExecutorConfig,
} from './subscription-payment-executor'

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Payment Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  calculateNextExecution,
  getScheduleDescription,
  ScheduledPaymentService,
  scheduledPaymentService,
} from './scheduled-payment-service'

// ─────────────────────────────────────────────────────────────────────────────
// Split Payment Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  validateSplitRecipients,
  calculateSplitAmounts,
  SplitPaymentService,
  splitPaymentService,
} from './split-payment-service'

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Signature Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  // verifySignature conflicts with eip712.service — alias
  verifySignature as verifyMultisigSignature,
  createTransactionMessage,
  hasReachedThreshold,
  MultisigService,
  multisigService,
} from './multisig-service'

export type {
  MultisigTransactionStatus,
  MultisigWallet,
  MultisigTransaction,
  MultisigConfirmation,
  CreateTransactionInput,
} from './multisig-service'

// ─────────────────────────────────────────────────────────────────────────────
// Analytics & Reporting
// ─────────────────────────────────────────────────────────────────────────────

export {
  AnalyticsService,
  analyticsService,
} from './analytics-service'

export type {
  AnalyticsSummary,
  MonthlyData,
  VendorAnalytics,
  ChainAnalytics,
  DateRange,
} from './analytics-service'

export {
  ExportService,
  exportService,
} from './export-service'

export type {
  AccountingReport,
  TokenBreakdown,
  CategoryBreakdown,
  VendorBreakdown,
  AccountingTransaction,
  ReportParams,
  ExportFormat,
} from './export-service'

export {
  aggregateByMonth,
  calculateYTDGrowth,
  filterTransactions,
  getLast12MonthsData,
  calculateTransactionStats,
  aggregateTransactionsByMonth,
} from './history-service'

// ─────────────────────────────────────────────────────────────────────────────
// Billing & Budget Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  BillingService,
  billingService,
} from './billing-service'

export type {
  CreateSubscriptionParams,
  RecordFeeParams,
  UsageMetrics,
} from './billing-service'

export {
  // setUseDatabaseStorage conflicts across multiple files — alias
  setUseDatabaseStorage as setBudgetUseDatabaseStorage,
  BudgetService,
  budgetService,
} from './budget-service'

export type {
  BudgetPeriod,
  AgentBudget,
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetUtilization,
  BudgetAvailability,
} from './budget-service'

// ─────────────────────────────────────────────────────────────────────────────
// Team Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  TeamService,
  teamService,
} from './team-service'

// ─────────────────────────────────────────────────────────────────────────────
// API Key Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  generateAPIKeySecret,
  hashAPIKeySecret,
  extractKeyPrefix,
  isValidAPIKeyFormat,
  APIKeyService,
  apiKeyService,
} from './api-key-service'

export type {
  Permission,
  APIKey,
  CreateAPIKeyInput,
  APIKeyValidationResult,
  APIKeyUsageLog,
} from './api-key-service'

// ─────────────────────────────────────────────────────────────────────────────
// Health & Infrastructure
// ─────────────────────────────────────────────────────────────────────────────

export {
  HealthMonitorService,
  healthMonitorService,
} from './health-monitor-service'

export type {
  ServiceStatus,
  ComponentHealth,
  HealthCheckResult,
  BasicHealthResult,
} from './health-monitor-service'

export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
} from './circuit-breaker'

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './circuit-breaker'

export {
  GoServicesBridge,
  goServicesBridge,
} from './go-services-bridge'

export type {
  PayoutRequest,
  PayoutResponse,
  FallbackEvent,
} from './go-services-bridge'

// ─────────────────────────────────────────────────────────────────────────────
// Ledger, Settlement & Risk Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  recordTransfer,
  lockBalance,
  unlockBalance,
  getUserBalances,
  getLedgerEntries,
  generateIdempotencyKey,
} from './ledger-service'

export type {
  EntryCategory,
  LedgerTransferParams,
  LedgerLockParams,
  BalanceInfo,
} from './ledger-service'

export {
  createSettlement,
  resolveDiscrepancy,
  listSettlements,
  getDiscrepancies,
} from './settlement-service'

export type {
  SettlementStatus,
  CreateSettlementParams,
  ReconciliationResult,
} from './settlement-service'

export {
  assessTransaction,
  screenAddress,
  getRiskHistory,
} from './risk-service'

export type {
  RiskLevel,
  RiskDecision,
  RiskFactor,
  RiskAssessmentResult,
  AssessTransactionParams,
} from './risk-service'

export {
  fetchOnChainBalances,
  syncUserBalances,
  getOnChainBalance,
  getSupportedSyncTargets,
} from './balance-sync-service'

export type {
  OnChainBalance,
  SyncResult,
} from './balance-sync-service'

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Chain Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  createCrossChainTransaction,
  transitionState,
  getCrossChainTransaction,
  listCrossChainTransactions,
  findStalledTransactions,
} from './cross-chain-state-machine'

export type {
  CrossChainState,
  TransitionTrigger,
  CreateCrossChainParams,
} from './cross-chain-state-machine'

// ─────────────────────────────────────────────────────────────────────────────
// TRON Payment Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  TronError,
  parseTronError,
  getTronNetwork,
  isValidTronAddress,
  getTRC20Balance,
  sendTRC20,
  sendTRX,
  processTronPayment,
  processTronBatchPayments,
  getAccountResources,
  estimateTRC20Resources,
  getTronTransaction,
  waitForTronConfirmation,
  getConfirmationInfo,
} from './tron-payment'

// ─────────────────────────────────────────────────────────────────────────────
// PB-Stream / HTTP-402 Micropayment Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  openPaymentChannel,
  getPaymentChannel,
  closePaymentChannel,
  processMicropayment,
  generatePaymentRequiredResponse,
  settleChannel,
  getConsumerChannels,
  getProviderChannels,
  getChannelPayments,
  getChannelStats,
  checkPaymentRequired,
} from './pb-stream-service'

export type {
  PaymentChannel,
  ChannelStatus,
  MicropaymentRequest,
  MicropaymentResult,
  PaymentRequiredResponse,
  SettlementResult,
  ChannelPayment,
} from './pb-stream-service'

// ─────────────────────────────────────────────────────────────────────────────
// Agent Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentUseDatabaseStorage,
  generateAgentApiKey,
  hashApiKey,
  // generateWebhookSecret conflicts with webhook-service — alias
  generateWebhookSecret as generateAgentWebhookSecret,
  agentService,
} from './agent-service'

export type {
  AgentType,
  AgentStatus,
  AutoExecuteRules,
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentValidationResult,
} from './agent-service'

export {
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentActivityUseDatabaseStorage,
  AgentActivityService,
  agentActivityService,
} from './agent-activity-service'

export type {
  AgentAction,
  AgentActivity,
  AgentAnalytics,
} from './agent-activity-service'

export {
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentX402UseDatabaseStorage,
  AgentX402Service,
  agentX402Service,
} from './agent-x402-service'

export type {
  X402Authorization,
  X402Signature,
  X402ExecutionResult,
} from './agent-x402-service'

export {
  AutoExecuteService,
  autoExecuteService,
} from './auto-execute-service'

export type {
  AutoExecuteResult,
  RuleCheckResult,
} from './auto-execute-service'

export {
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setProposalUseDatabaseStorage,
  ProposalService,
  proposalService,
} from './proposal-service'

export type {
  ProposalStatus,
  PaymentProposal,
  CreateProposalInput,
  ProposalFilters,
} from './proposal-service'

export {
  AgentIntegrationService,
  agentIntegrationService,
} from './agent-integration-service'

export type {
  ProposalLifecycleResult,
  AuditLogEntry,
} from './agent-integration-service'

export {
  agentCardService,
} from './agent-card-service'

export type {
  AgentCardRecord,
} from './agent-card-service'

export {
  a2aService,
} from './a2a-service'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Activity Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  DashboardActivityService,
  dashboardActivityService,
} from './dashboard-activity-service'

export type {
  ActivityItem,
  DashboardActivity,
} from './dashboard-activity-service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Security
// ─────────────────────────────────────────────────────────────────────────────

export {
  DoubleSpendPreventionService,
  doubleSpendPreventionService,
} from './security/double-spend-prevention.service'

export type {
  // VerificationResult conflicts with signature-verifier.service — alias
  VerificationResult as DoubleSpendVerificationResult,
} from './security/double-spend-prevention.service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Yield
// ─────────────────────────────────────────────────────────────────────────────

export {
  YieldAggregatorService,
  yieldAggregatorService,
} from './yield/yield-aggregator.service'

export type {
  YieldNetwork,
  MerchantYieldBalance,
  DepositRecord,
  WithdrawalRecord,
} from './yield/yield-aggregator.service'

export {
  TronYieldService,
  tronYieldService,
  tronYieldServiceNile,
} from './yield/tron-yield.service'

export type {
  TronNetwork,
  TronYieldBalance,
} from './yield/tron-yield.service'

export {
  UnifiedYieldService,
  unifiedYieldService,
} from './yield/unified-yield.service'

export type {
  AllNetworks,
  UnifiedYieldBalance,
} from './yield/unified-yield.service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Queue
// NOTE: queue/payment-queue.service is intentionally excluded from this barrel.
// It initialises a BullMQ queue (Redis connection) on import, which causes
// side-effect crashes when the barrel is loaded in build-time static analysis.
// Import directly: import { paymentQueueService } from '@/lib/services/queue/payment-queue.service'
// ─────────────────────────────────────────────────────────────────────────────
