/**
 * ProtocolBanks MCP Server - Logger Utility
 * 
 * Provides structured logging with sensitive data filtering.
 */

import type { LogLevel, LoggerConfig } from '../types';

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Default sensitive fields to filter from logs */
const DEFAULT_SENSITIVE_FIELDS = [
  'signature',
  'privateKey',
  'private_key',
  'secret',
  'apiKey',
  'api_key',
  'password',
  'token',
  'authorization',
];

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private sensitiveFields: string[];

  constructor(config: LoggerConfig = { level: 'info' }) {
    this.level = config.level;
    this.prefix = config.prefix || 'MCP';
    this.sensitiveFields = [
      ...DEFAULT_SENSITIVE_FIELDS,
      ...(config.sensitiveFields || []),
    ];
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}]`;
    
    // Filter sensitive data
    const safeData = data ? this.filterSensitiveData(data) : undefined;
    
    const logMessage = safeData 
      ? `${prefix} ${message} ${JSON.stringify(safeData)}`
      : `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  /**
   * Filter sensitive data from log output
   */
  private filterSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterSensitiveData(value as Record<string, unknown>);
      } else {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  /**
   * Check if a field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive.toLowerCase())
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

// ============================================================================
// Default Export
// ============================================================================

export const defaultLogger = new Logger({ level: 'info' });
