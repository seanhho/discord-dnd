/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry metadata
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
}

/**
 * Log level hierarchy for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

/**
 * Simple structured logger with level filtering
 */
export class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig) {
    this.config = {
      level: config.level,
      prefix: config.prefix ?? '',
    };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Format and output a log message
   */
  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    const levelTag = level.toUpperCase().padEnd(5);

    const formattedMessage = `${COLORS.dim}${timestamp}${COLORS.reset} ${color}${levelTag}${COLORS.reset} ${prefix}${message}`;

    const logFn = level === 'error' ? console.error : console.log;

    if (meta && Object.keys(meta).length > 0) {
      logFn(formattedMessage, meta);
    } else {
      logFn(formattedMessage);
    }
  }

  /**
   * Log debug message (lowest priority)
   */
  debug(message: string, meta?: LogMetadata): void {
    this.log('debug', message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: LogMetadata): void {
    this.log('info', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: LogMetadata): void {
    this.log('warn', message, meta);
  }

  /**
   * Log error message (highest priority)
   */
  error(message: string, meta?: LogMetadata): void {
    this.log('error', message, meta);
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.config.level,
      prefix: this.config.prefix
        ? `${this.config.prefix}:${prefix}`
        : prefix,
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}
