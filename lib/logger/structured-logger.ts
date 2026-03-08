/**
 * Structured Logger Service
 *
 * 企业级结构化日志系统，基于 Winston
 *
 * 功能:
 * - 统一日志格式 (JSON, timestamped)
 * - 日志级别管理 (error, warn, info, debug)
 * - 上下文追踪 (traceId, userId, merchantId)
 * - 性能监控 (API latency, database query time)
 * - 错误聚合 (同类错误自动归类)
 * - ELK Stack 兼容 (可选)
 *
 * 使用场景:
 * - Payment processing: 记录每笔交易的完整生命周期
 * - Security monitoring: 记录所有安全相关事件
 * - Performance tracking: 记录 API 响应时间和数据库查询
 * - Error debugging: 记录完整的错误堆栈和上下文
 */

import winston from 'winston'
import { v4 as uuidv4 } from 'uuid'

/**
 * Sensitive field patterns to sanitize from logs
 */
const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'private_key', 'privateKey', 'mnemonic',
  'seed', 'pin', 'token', 'api_key', 'apiKey', 'authorization',
  'cookie', 'session', 'share_a', 'share_b', 'share_c',
  'server_share', 'encrypted_share', 'recovery_share',
  'key_secret', 'webhook_secret', 'api_secret',
])

function sanitizeValue(obj: any, depth = 0): any {
  if (depth > 10 || obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeValue(item, depth + 1))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeValue(value, depth + 1)
    }
  }
  return sanitized
}

/**
 * Winston format that sanitizes sensitive fields
 */
const sanitizeFormat = winston.format((info) => {
  // Sanitize metadata inside context
  const ctx = info.context as any
  if (ctx?.metadata) {
    ctx.metadata = sanitizeValue(ctx.metadata)
  }
  // Also sanitize top-level context fields (userId, traceId are safe, but catch any sensitive ones)
  if (info.context) {
    info.context = sanitizeValue(info.context)
  }
  // Sanitize top-level metadata if present
  if ((info as any).metadata) {
    (info as any).metadata = sanitizeValue((info as any).metadata)
  }
  return info
})

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * 日志上下文
 */
export interface LogContext {
  traceId?: string          // 请求追踪 ID
  userId?: string           // 用户 ID
  merchantId?: string       // 商户 ID
  txHash?: string          // 交易哈希
  orderId?: string         // 订单 ID
  network?: string         // 网络 (tron, ethereum, base, arbitrum)
  component?: string       // 组件名称
  action?: string          // 操作类型
  metadata?: Record<string, any>  // 额外元数据
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  duration: number         // 耗时 (ms)
  operation: string        // 操作名称
  status: 'success' | 'error'
  details?: Record<string, any>
}

/**
 * Structured Logger
 */
export class StructuredLogger {
  private logger: winston.Logger
  private defaultContext: LogContext = {}

  constructor(serviceName: string = 'protocol-banks') {
    // 创建 Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        sanitizeFormat(),
        winston.format.json(),
        winston.format.printf((info) => {
          // 自定义格式，便于 ELK 解析
          const infoAny = info as any
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            service: serviceName,
            message: info.message,
            ...(infoAny.context || {}),
            ...(infoAny.error ? {
              error: {
                message: infoAny.error.message,
                stack: infoAny.error.stack,
                code: infoAny.error.code
              }
            } : {}),
            ...(infoAny.metrics ? { metrics: infoAny.metrics } : {})
          })
        })
      ),
      transports: [
        // Console transport (all environments — Vercel captures stdout/stderr)
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf((info) => {
              const infoAny = info as any
              const contextStr = infoAny.context ? ` [${JSON.stringify(infoAny.context)}]` : ''
              const errorStr = infoAny.error ? `\n  Error: ${infoAny.error.message}\n  Stack: ${infoAny.error.stack}` : ''
              return `${info.timestamp} [${info.level}]${contextStr}: ${info.message}${errorStr}`
            })
          )
        }),

        // File transports — only in non-serverless environments
        // Vercel serverless has a read-only filesystem; use Vercel Logs instead
        ...(process.env.VERCEL
          ? []
          : [
              new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 10485760,  // 10MB
                maxFiles: 5
              }),
              new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 10485760,
                maxFiles: 10
              })
            ]
        )
      ],

      // Exception/rejection handlers — only file-based in non-serverless
      ...(process.env.VERCEL
        ? {}
        : {
            exceptionHandlers: [
              new winston.transports.File({ filename: 'logs/exceptions.log' })
            ],
            rejectionHandlers: [
              new winston.transports.File({ filename: 'logs/rejections.log' })
            ]
          }
      )
    })

    console.log(`[StructuredLogger] Initialized for service: ${serviceName}`)
  }

  /**
   * 设置默认上下文（整个 request lifecycle 共享）
   *
   * @param context - 上下文数据
   */
  setDefaultContext(context: LogContext) {
    this.defaultContext = { ...this.defaultContext, ...context }
  }

  /**
   * 清除默认上下文
   */
  clearDefaultContext() {
    this.defaultContext = {}
  }

  /**
   * 生成 trace ID
   */
  generateTraceId(): string {
    return uuidv4()
  }

  /**
   * 记录 Info 日志
   *
   * @param message - 日志消息
   * @param context - 上下文
   */
  info(message: string, context?: LogContext) {
    this.logger.info(message, {
      context: { ...this.defaultContext, ...context }
    })
  }

  /**
   * 记录 Warn 日志
   *
   * @param message - 日志消息
   * @param context - 上下文
   */
  warn(message: string, context?: LogContext) {
    this.logger.warn(message, {
      context: { ...this.defaultContext, ...context }
    })
  }

  /**
   * 记录 Error 日志
   *
   * @param message - 日志消息
   * @param error - 错误对象
   * @param context - 上下文
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.logger.error(message, {
      context: { ...this.defaultContext, ...context },
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    })
  }

  /**
   * 记录 Debug 日志
   *
   * @param message - 日志消息
   * @param context - 上下文
   */
  debug(message: string, context?: LogContext) {
    this.logger.debug(message, {
      context: { ...this.defaultContext, ...context }
    })
  }

  /**
   * 记录支付相关日志
   *
   * @param stage - 支付阶段 (initiated, verified, completed, failed)
   * @param txHash - 交易哈希
   * @param amount - 金额
   * @param context - 上下文
   */
  logPayment(
    stage: 'initiated' | 'verified' | 'completed' | 'failed',
    txHash: string,
    amount: string,
    context?: LogContext
  ) {
    const emoji = {
      initiated: '🔄',
      verified: '✅',
      completed: '🎉',
      failed: '❌'
    }[stage]

    this.info(`${emoji} Payment ${stage}: ${amount} USDT`, {
      ...context,
      txHash,
      action: 'payment',
      metadata: { stage, amount }
    })
  }

  /**
   * 记录安全事件
   *
   * @param eventType - 事件类型
   * @param severity - 严重程度
   * @param details - 详细信息
   * @param context - 上下文
   */
  logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context?: LogContext
  ) {
    const emoji = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    }[severity]

    this.warn(`${emoji} Security Event: ${eventType}`, {
      ...context,
      action: 'security',
      metadata: {
        eventType,
        severity,
        ...details
      }
    })
  }

  /**
   * 记录性能指标
   *
   * @param metrics - 性能指标
   * @param context - 上下文
   */
  logPerformance(metrics: PerformanceMetrics, context?: LogContext) {
    const emoji = metrics.status === 'success' ? '⚡' : '⚠️'
    const message = `${emoji} Performance: ${metrics.operation} (${metrics.duration}ms)`

    if (metrics.duration > 1000) {
      // 超过 1 秒，记录为 warn
      this.warn(message, {
        ...context,
        action: 'performance',
        metadata: metrics
      })
    } else {
      this.info(message, {
        ...context,
        action: 'performance',
        metadata: metrics
      })
    }
  }

  /**
   * 记录 API 请求
   *
   * @param method - HTTP 方法
   * @param path - 请求路径
   * @param statusCode - 状态码
   * @param duration - 耗时 (ms)
   * @param context - 上下文
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ) {
    const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅'
    const message = `${emoji} ${method} ${path} - ${statusCode} (${duration}ms)`

    if (statusCode >= 500) {
      this.error(message, undefined, {
        ...context,
        action: 'api_request',
        metadata: { method, path, statusCode, duration }
      })
    } else if (statusCode >= 400) {
      this.warn(message, {
        ...context,
        action: 'api_request',
        metadata: { method, path, statusCode, duration }
      })
    } else {
      this.info(message, {
        ...context,
        action: 'api_request',
        metadata: { method, path, statusCode, duration }
      })
    }
  }

  /**
   * 记录数据库查询
   *
   * @param query - 查询类型 (select, insert, update, delete)
   * @param table - 表名
   * @param duration - 耗时 (ms)
   * @param context - 上下文
   */
  logDatabaseQuery(
    query: string,
    table: string,
    duration: number,
    context?: LogContext
  ) {
    const emoji = duration > 100 ? '🐌' : '⚡'
    const message = `${emoji} DB Query: ${query} on ${table} (${duration}ms)`

    if (duration > 100) {
      this.warn(message, {
        ...context,
        action: 'database',
        metadata: { query, table, duration }
      })
    } else {
      this.debug(message, {
        ...context,
        action: 'database',
        metadata: { query, table, duration }
      })
    }
  }

  /**
   * 记录区块链交互
   *
   * @param network - 网络
   * @param method - 方法 (transfer, call, etc.)
   * @param txHash - 交易哈希
   * @param status - 状态
   * @param context - 上下文
   */
  logBlockchainInteraction(
    network: string,
    method: string,
    txHash: string,
    status: 'pending' | 'success' | 'failed',
    context?: LogContext
  ) {
    const emoji = {
      pending: '🔄',
      success: '✅',
      failed: '❌'
    }[status]

    const message = `${emoji} Blockchain [${network}]: ${method} - ${txHash}`

    if (status === 'failed') {
      this.error(message, undefined, {
        ...context,
        network,
        txHash,
        action: 'blockchain',
        metadata: { method, status }
      })
    } else {
      this.info(message, {
        ...context,
        network,
        txHash,
        action: 'blockchain',
        metadata: { method, status }
      })
    }
  }

  /**
   * 记录 Webhook 调用
   *
   * @param url - Webhook URL
   * @param event - 事件类型
   * @param statusCode - 响应状态码
   * @param attempt - 第几次尝试
   * @param context - 上下文
   */
  logWebhook(
    url: string,
    event: string,
    statusCode: number,
    attempt: number,
    context?: LogContext
  ) {
    const emoji = statusCode >= 200 && statusCode < 300 ? '📤' : '🔁'
    const message = `${emoji} Webhook [${event}] to ${url} - ${statusCode} (attempt ${attempt})`

    if (statusCode >= 200 && statusCode < 300) {
      this.info(message, {
        ...context,
        action: 'webhook',
        metadata: { url, event, statusCode, attempt }
      })
    } else {
      this.warn(message, {
        ...context,
        action: 'webhook',
        metadata: { url, event, statusCode, attempt }
      })
    }
  }

  /**
   * 创建子 logger（继承父上下文）
   *
   * @param additionalContext - 额外上下文
   * @returns 新的 logger 实例
   */
  child(additionalContext: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger('protocol-banks')
    childLogger.setDefaultContext({
      ...this.defaultContext,
      ...additionalContext
    })
    return childLogger
  }
}

/**
 * 创建全局 logger 实例
 */
export const logger = new StructuredLogger('protocol-banks')

/**
 * 性能计时器装饰器
 *
 * 使用方法:
 * @LogPerformance('operation-name')
 * async myFunction() { ... }
 */
export function LogPerformance(operationName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now()
      let status: 'success' | 'error' = 'success'

      try {
        const result = await originalMethod.apply(this, args)
        return result
      } catch (error) {
        status = 'error'
        throw error
      } finally {
        const duration = Date.now() - startTime
        logger.logPerformance({
          operation: operationName,
          duration,
          status,
          details: {
            className: target.constructor.name,
            methodName: propertyKey
          }
        })
      }
    }

    return descriptor
  }
}

/**
 * Request ID 中间件工厂函数
 *
 * 使用方法:
 * const middleware = createRequestLoggerMiddleware()
 * app.use(middleware)
 */
export function createRequestLoggerMiddleware() {
  return function (req: any, res: any, next: any) {
    const traceId = req.headers['x-trace-id'] || logger.generateTraceId()
    const startTime = Date.now()

    // 注入 logger 到 request
    req.logger = logger.child({
      traceId,
      userId: req.headers['x-user-address']
    })

    // 记录请求开始
    req.logger.info(`➡️  Incoming request: ${req.method} ${req.path}`, {
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    })

    // 监听响应结束
    res.on('finish', () => {
      const duration = Date.now() - startTime
      req.logger.logApiRequest(
        req.method,
        req.path,
        res.statusCode,
        duration
      )
    })

    next()
  }
}

export default logger
