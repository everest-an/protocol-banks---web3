/**
 * ProtocolBanks SDK - Secure Logger
 * 
 * 安全日志记录器，支持:
 * - 敏感数据自动过滤
 * - 多级别日志 (debug, info, warn, error)
 * - 结构化日志输出
 * - 自定义日志处理器
 */

import type { Logger, LogLevel } from '../types';
import { maskSensitive, isSensitiveData } from './crypto';

// ============================================================================
// Types
// ============================================================================

/** Log entry */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  requestId?: string;
  duration?: number;
}

/** Log handler function */
export type LogHandler = (entry: LogEntry) => void;

/** Secure logger options */
export interface SecureLoggerOptions {
  level?: LogLevel;
  handlers?: LogHandler[];
  enableConsole?: boolean;
  prefix?: string;
  sensitiveFields?: string[];
}

// ============================================================================
// Log Level Priority
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// ============================================================================
// Default Sensitive Fields
// ============================================================================

const DEFAULT_SENSITIVE_FIELDS = [
  'apiKey',
  'apiSecret',
  'secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'privateKey',
  'signature',
  'authorization',
  'bearer',
  'credential',
  'key',
];

// ============================================================================
// Secure Logger Implementation
// ============================================================================

export class SecureLogger implements Logger {
  private level: LogLevel;
  private handlers: LogHandler[];
  private enableConsole: boolean;
  private prefix: string;
  private sensitiveFields: string[];
  
  constructor(options: SecureLoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.handlers = options.handlers ?? [];
    this.enableConsole = options.enableConsole ?? true;
    this.prefix = options.prefix ?? '[ProtocolBanks]';
    this.sensitiveFields = [
      ...DEFAULT_SENSITIVE_FIELDS,
      ...(options.sensitiveFields ?? []),
    ];
  }
  
  // ============================================================================
  // Public Methods
  // ============================================================================
  
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args);
  }
  
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args);
  }
  
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args);
  }
  
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args);
  }
  
  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  /**
   * Add log handler
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Remove log handler
   */
  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }
  
  /**
   * Create child logger with prefix
   */
  child(prefix: string): SecureLogger {
    return new SecureLogger({
      level: this.level,
      handlers: this.handlers,
      enableConsole: this.enableConsole,
      prefix: `${this.prefix} ${prefix}`,
      sensitiveFields: this.sensitiveFields,
    });
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private log(level: LogLevel, message: string, args: unknown[]): void {
    // Check if level is enabled
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }
    
    // Sanitize arguments
    const sanitizedArgs = args.map(arg => this.sanitize(arg));
    
    // Create log entry
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
    };
    
    if (sanitizedArgs.length > 0) {
      entry.data = this.mergeArgs(sanitizedArgs);
    }
    
    // Console output
    if (this.enableConsole) {
      this.consoleLog(entry);
    }
    
    // Call handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch {
        // Ignore handler errors
      }
    }
  }
  
  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    
    if (typeof value === 'object') {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: this.sanitizeString(value.message),
          stack: value.stack?.split('\n').slice(0, 5).join('\n'),
        };
      }
      
      if (Array.isArray(value)) {
        return value.map(item => this.sanitize(item));
      }
      
      return this.sanitizeObject(value as Record<string, unknown>);
    }
    
    return value;
  }
  
  private sanitizeString(value: string): string {
    // Check if it looks like sensitive data
    if (isSensitiveData(value)) {
      return maskSensitive(value);
    }
    
    return value;
  }
  
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      const isSensitiveKey = this.sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitiveKey) {
        if (typeof value === 'string') {
          result[key] = maskSensitive(value);
        } else {
          result[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitize(value);
      } else if (typeof value === 'string') {
        result[key] = this.sanitizeString(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  private mergeArgs(args: unknown[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
        Object.assign(result, arg);
      } else {
        result[`arg${i}`] = arg;
      }
    }
    
    return result;
  }
  
  private consoleLog(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const prefix = this.prefix;
    
    const baseMessage = `${timestamp} ${levelStr} ${prefix} ${entry.message}`;
    
    const consoleFn = this.getConsoleFn(entry.level);
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      consoleFn(baseMessage, entry.data);
    } else {
      consoleFn(baseMessage);
    }
  }
  
  private getConsoleFn(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug.bind(console);
      case 'info':
        return console.info.bind(console);
      case 'warn':
        return console.warn.bind(console);
      case 'error':
        return console.error.bind(console);
      default:
        return console.log.bind(console);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a secure logger instance
 */
export function createSecureLogger(options?: SecureLoggerOptions): SecureLogger {
  return new SecureLogger(options);
}

/**
 * Create a no-op logger (silent)
 */
export function createSilentLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

/**
 * Create a console-only logger
 */
export function createConsoleLogger(level: LogLevel = 'info'): SecureLogger {
  return new SecureLogger({
    level,
    enableConsole: true,
    handlers: [],
  });
}

// ============================================================================
// Request Logger Helper
// ============================================================================

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  baseLogger: Logger,
  requestId: string
): Logger {
  const prefix = `[${requestId}]`;
  
  return {
    debug: (message: string, ...args: unknown[]) => 
      baseLogger.debug(`${prefix} ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => 
      baseLogger.info(`${prefix} ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => 
      baseLogger.warn(`${prefix} ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => 
      baseLogger.error(`${prefix} ${message}`, ...args),
  };
}

// ============================================================================
// Performance Logger Helper
// ============================================================================

/**
 * Create a performance timer
 */
export function createTimer(logger: Logger, operation: string): () => void {
  const start = performance.now();
  
  return () => {
    const duration = performance.now() - start;
    logger.debug(`${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
  };
}

/**
 * Wrap async function with timing
 */
export async function withTiming<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const endTimer = createTimer(logger, operation);
  try {
    return await fn();
  } finally {
    endTimer();
  }
}
