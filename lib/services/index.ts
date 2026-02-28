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
  BatchPaymentItem,
  BatchValidationResult,
  BatchValidationError,
  MAX_BATCH_SIZE,
  MIN_AMOUNT,
  validateBatchItem,
  validateBatch,
  findDuplicateRecipients,
  calculateBatchTotals,
} from './batch-validator.service'

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
  DomainInput,
  AuthorizationMessage,
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
  AuthorizationParams,
  GeneratedAuthorization,
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
  VerificationResult as SignatureVerificationResult,
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
  FeeBreakdown,
  FeeConfig,
  DEFAULT_FEE_CONFIG,
  NETWORK_GAS_ESTIMATES,
  calculateFees,
  calculateBatchFees,
  getFeeTier,
  formatFee,
} from './fee-calculator.service'

export {
  RelayerFeeBreakdown,
  estimateGas,
  calculateRelayerFee,
  calculateBatchRelayerFee,
  getEstimatedConfirmationTime,
  formatRelayerFee,
} from './x402-fee-calculator.service'

export {
  FeeDistribution,
  FeeRecipient,
  calculateDistribution,
  logFeeDistribution,
  getFeeStatistics,
  createFeeDistribution,
} from './fee-distributor.service'

// ─────────────────────────────────────────────────────────────────────────────
// File & Report Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  ParsedRow,
  ParseResult,
  parseCsv,
  parseExcel,
  parseFile,
  parseBatchFile,
} from './file-parser.service'

export {
  BatchReportItem,
  BatchReport,
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
  IdempotencyResult,
  checkIdempotency,
  completeIdempotency,
  failIdempotency,
  cleanExpiredKeys,
} from './idempotency-service'

export {
  BatchExecutionResult,
  executeBatch,
} from './batch-execution-worker'

export {
  BatchItemStatus,
  CreateBatchItemsParams,
  UpdateBatchItemParams,
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
  BatchTransferRecipient,
  BatchTransferResult,
  ContractStats,
  // TOKEN_ADDRESSES conflicts with public-batch-transfer-service — alias both
  TOKEN_ADDRESSES as BATCH_TRANSFER_TOKEN_ADDRESSES,
  BatchTransferService,
  batchTransferService,
} from './batch-transfer-service'

export {
  PUBLIC_BATCH_CONTRACTS,
  // TOKEN_ADDRESSES conflicts with batch-transfer-service — alias
  TOKEN_ADDRESSES as PUBLIC_BATCH_TOKEN_ADDRESSES,
  BatchRecipient,
  BatchResult,
  PublicBatchTransferService,
  publicBatchTransferService,
} from './public-batch-transfer-service'

// ─────────────────────────────────────────────────────────────────────────────
// Relayer Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  RelayerProvider,
  RelayerConfig,
  RelayRequest,
  RelayResponse,
  ERC3009RelayRequest,
  RelayerService,
  relayerService,
  executeGaslessUSDCTransfer,
  isRelayerConfigured,
  getSupportedRelayChains,
} from './relayer-service'

export {
  RelayerSubmission,
  RelayerResponse,
  RelayerStatus,
  submitToRelayer,
  checkRelayerStatus,
  submitBatchToRelayer,
  getSupportedChains,
} from './relayer-client.service'

// ─────────────────────────────────────────────────────────────────────────────
// Recovery & Retry Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  FailedItem,
  RetryResult,
  RecoveryConfig,
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
  Vendor as VendorRecord,
  VendorPayment,
  VendorStats as VendorPaymentStats,
  VendorPaymentService,
  vendorPaymentService,
} from './vendor-payment-service'

export {
  VendorAddress,
  VendorWithAddresses,
  createVendorWithAddresses,
  getVendorWithAddresses,
  listVendorsWithAddresses,
  addVendorAddress,
  updateVendorAddress,
  deleteVendorAddress,
  getVendorAddressForNetwork,
  getVendorByAddress,
} from './vendor-multi-network.service'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  WebhookEvent,
  Webhook,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDelivery,
  WebhookPayload,
  generateWebhookSecret,
  hashWebhookSecret,
  // generateWebhookSignature conflicts with agent-webhook-service — alias
  generateWebhookSignature as generateHmacWebhookSignature,
  verifyWebhookSignature,
  calculateNextRetryTime,
  WebhookService,
  webhookService,
} from './webhook-service'

export {
  PaymentEventData,
  BatchPaymentEventData,
  MultisigEventData,
  SubscriptionEventData,
  WebhookTriggerService,
  webhookTriggerService,
  processWebhookDeliveries,
} from './webhook-trigger-service'

export {
  AgentWebhookEvent,
  AgentWebhookDelivery,
  // setUseDatabaseStorage conflicts across multiple files — alias per domain
  setUseDatabaseStorage as setAgentWebhookUseDatabaseStorage,
  // generateWebhookSignature conflicts with webhook-service — alias
  generateWebhookSignature as generateAgentWebhookSignature,
  verifyAgentWebhookSignature,
  AgentWebhookService,
  agentWebhookService,
} from './agent-webhook-service'

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  PushSubscription,
  NotificationPreferences,
  NotificationPayload,
  NotificationType,
  NotificationService,
  notificationService,
} from './notification-service'

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  SubscriptionFrequency,
  SubscriptionStatus,
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  isSubscriptionDue,
  SubscriptionService,
  subscriptionService,
} from './subscription-service'

export {
  PaymentExecutionResult,
  PaymentExecutorConfig,
  SubscriptionPaymentExecutor,
  subscriptionPaymentExecutor,
  processSubscriptionsCron,
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
  MultisigTransactionStatus,
  MultisigWallet,
  MultisigTransaction,
  MultisigConfirmation,
  CreateTransactionInput,
  // verifySignature conflicts with eip712.service — alias
  verifySignature as verifyMultisigSignature,
  createTransactionMessage,
  hasReachedThreshold,
  MultisigService,
  multisigService,
} from './multisig-service'

// ─────────────────────────────────────────────────────────────────────────────
// Analytics & Reporting
// ─────────────────────────────────────────────────────────────────────────────

export {
  AnalyticsSummary,
  MonthlyData,
  VendorAnalytics,
  ChainAnalytics,
  DateRange,
  AnalyticsService,
  analyticsService,
} from './analytics-service'

export {
  AccountingReport,
  TokenBreakdown,
  CategoryBreakdown,
  VendorBreakdown,
  AccountingTransaction,
  ReportParams,
  ExportFormat,
  ExportService,
  exportService,
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
  CreateSubscriptionParams,
  RecordFeeParams,
  UsageMetrics,
  BillingService,
  billingService,
} from './billing-service'

export {
  BudgetPeriod,
  AgentBudget,
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetUtilization,
  BudgetAvailability,
  // setUseDatabaseStorage conflicts across multiple files — alias
  setUseDatabaseStorage as setBudgetUseDatabaseStorage,
  BudgetService,
  budgetService,
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
  Permission,
  APIKey,
  CreateAPIKeyInput,
  APIKeyValidationResult,
  APIKeyUsageLog,
  generateAPIKeySecret,
  hashAPIKeySecret,
  extractKeyPrefix,
  isValidAPIKeyFormat,
  APIKeyService,
  apiKeyService,
} from './api-key-service'

// ─────────────────────────────────────────────────────────────────────────────
// Health & Infrastructure
// ─────────────────────────────────────────────────────────────────────────────

export {
  ServiceStatus,
  ComponentHealth,
  HealthCheckResult,
  BasicHealthResult,
  HealthMonitorService,
  healthMonitorService,
} from './health-monitor-service'

export {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitBreaker,
  CircuitBreakerOpenError,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
} from './circuit-breaker'

export {
  PayoutRequest,
  PayoutResponse,
  FallbackEvent,
  GoServicesBridge,
  goServicesBridge,
} from './go-services-bridge'

// ─────────────────────────────────────────────────────────────────────────────
// Ledger, Settlement & Risk Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  EntryCategory,
  LedgerTransferParams,
  LedgerLockParams,
  BalanceInfo,
  recordTransfer,
  lockBalance,
  unlockBalance,
  getUserBalances,
  getLedgerEntries,
  generateIdempotencyKey,
} from './ledger-service'

export {
  SettlementStatus,
  CreateSettlementParams,
  ReconciliationResult,
  createSettlement,
  resolveDiscrepancy,
  listSettlements,
  getDiscrepancies,
} from './settlement-service'

export {
  RiskLevel,
  RiskDecision,
  RiskFactor,
  RiskAssessmentResult,
  AssessTransactionParams,
  assessTransaction,
  screenAddress,
  getRiskHistory,
} from './risk-service'

export {
  OnChainBalance,
  SyncResult,
  fetchOnChainBalances,
  syncUserBalances,
  getOnChainBalance,
  getSupportedSyncTargets,
} from './balance-sync-service'

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Chain Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  CrossChainState,
  TransitionTrigger,
  CreateCrossChainParams,
  createCrossChainTransaction,
  transitionState,
  getCrossChainTransaction,
  listCrossChainTransactions,
  findStalledTransactions,
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
  PaymentChannel,
  ChannelStatus,
  MicropaymentRequest,
  MicropaymentResult,
  PaymentRequiredResponse,
  SettlementResult,
  ChannelPayment,
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

// ─────────────────────────────────────────────────────────────────────────────
// Agent Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  AgentType,
  AgentStatus,
  AutoExecuteRules,
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentValidationResult,
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentUseDatabaseStorage,
  generateAgentApiKey,
  hashApiKey,
  // generateWebhookSecret conflicts with webhook-service — alias
  generateWebhookSecret as generateAgentWebhookSecret,
  agentService,
} from './agent-service'

export {
  AgentAction,
  AgentActivity,
  AgentAnalytics,
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentActivityUseDatabaseStorage,
  AgentActivityService,
  agentActivityService,
} from './agent-activity-service'

export {
  X402Authorization,
  X402Signature,
  X402ExecutionResult,
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setAgentX402UseDatabaseStorage,
  AgentX402Service,
  agentX402Service,
} from './agent-x402-service'

export {
  AutoExecuteResult,
  RuleCheckResult,
  AutoExecuteService,
  autoExecuteService,
} from './auto-execute-service'

export {
  ProposalStatus,
  PaymentProposal,
  CreateProposalInput,
  ProposalFilters,
  // setUseDatabaseStorage conflicts — alias
  setUseDatabaseStorage as setProposalUseDatabaseStorage,
  ProposalService,
  proposalService,
} from './proposal-service'

export {
  ProposalLifecycleResult,
  AuditLogEntry,
  AgentIntegrationService,
  agentIntegrationService,
} from './agent-integration-service'

export {
  AgentCardRecord,
  agentCardService,
} from './agent-card-service'

export {
  a2aService,
} from './a2a-service'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Activity Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  ActivityItem,
  DashboardActivity,
  DashboardActivityService,
  dashboardActivityService,
} from './dashboard-activity-service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Security
// ─────────────────────────────────────────────────────────────────────────────

export {
  // VerificationResult conflicts with signature-verifier.service — alias
  VerificationResult as DoubleSpendVerificationResult,
  DoubleSpendPreventionService,
  doubleSpendPreventionService,
} from './security/double-spend-prevention.service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Yield
// ─────────────────────────────────────────────────────────────────────────────

export {
  YieldNetwork,
  MerchantYieldBalance,
  DepositRecord,
  WithdrawalRecord,
  YieldAggregatorService,
  yieldAggregatorService,
} from './yield/yield-aggregator.service'

export {
  TronNetwork,
  TronYieldBalance,
  TronYieldService,
  tronYieldService,
  tronYieldServiceNile,
} from './yield/tron-yield.service'

export {
  AllNetworks,
  UnifiedYieldBalance,
  CrossNetworkSummary,
  UnifiedYieldService,
  unifiedYieldService,
} from './yield/unified-yield.service'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-directory: Queue
// ─────────────────────────────────────────────────────────────────────────────

export {
  PaymentTask,
  PaymentQueueService,
  paymentQueueService,
} from './queue/payment-queue.service'
