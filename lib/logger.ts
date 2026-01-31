/**
 * Unified Logger for Protocol Banks
 * 
 * Replaces console.log with structured, environment-aware logging.
 * - Development: Pretty console output
 * - Production: Structured JSON for log aggregation
 * - Auto-filters sensitive data
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  service?: string;
}

// Sensitive fields to mask in logs
const SENSITIVE_FIELDS = [
  'password', 'secret', 'apiKey', 'api_key', 'token', 'accessToken',
  'privateKey', 'private_key', 'mnemonic', 'seed', 'signature',
  'authorization', 'cookie', 'session'
];

/**
 * Mask sensitive values in objects
 */
function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Mask wallet addresses partially
    if (data.match(/^0x[a-fA-F0-9]{40}$/)) {
      return `${data.slice(0, 6)}...${data.slice(-4)}`;
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  
  if (typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return data;
}

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel as LogLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private service: string;
  private minLevel: LogLevel;

  constructor(service: string = 'app') {
    this.service = service;
    this.minLevel = getLogLevel();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_PRIORITY[level] >= LOG_PRIORITY[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      context: context ? maskSensitiveData(context) as LogContext : undefined,
    };
  }

  private output(entry: LogEntry): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Structured JSON for production
      console.log(JSON.stringify(entry));
    } else {
      // Pretty output for development
      const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const color = levelColors[entry.level];
      
      const prefix = `${color}[${entry.level.toUpperCase()}]${reset} [${entry.service}]`;
      
      if (entry.context) {
        console.log(`${prefix} ${entry.message}`, entry.context);
      } else {
        console.log(`${prefix} ${entry.message}`);
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, context));
    }
  }

  /**
   * Create a child logger with a specific service name
   */
  child(service: string): Logger {
    return new Logger(`${this.service}:${service}`);
  }
}

// Default logger instance
export const logger = new Logger('protocol-banks');

// Named loggers for different modules
export const paymentLogger = new Logger('payment');
export const webhookLogger = new Logger('webhook');
export const securityLogger = new Logger('security');
export const apiLogger = new Logger('api');

// Factory function for custom loggers
export function createLogger(service: string): Logger {
  return new Logger(service);
}

export default logger;
