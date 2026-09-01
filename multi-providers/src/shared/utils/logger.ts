/**
 * @file src/utils/logger.ts
 * Configurable logger utility for MCP Gateway
 */

export enum LogLevel {
  ERROR = 0,
  CRITICAL = 1, // New level for critical information
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

class Logger {
  private config: LoggerConfig;
  private colors = {
    error: '\x1b[31m', // red
    critical: '\x1b[35m', // magenta
    warn: '\x1b[33m', // yellow
    info: '\x1b[36m', // cyan
    debug: '\x1b[37m', // white
    reset: '\x1b[0m',
  };

  constructor(config: LoggerConfig) {
    this.envonfig = {
      timestamp: true,
      colors: true,
      ...config,
    };
  }

  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (this.envonfig.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.envonfig.prefix) {
      parts.push(`[${this.envonfig.prefix}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
  }

  private log(level: LogLevel, levelName: string, message: string, data?: any) {
    if (level > this.envonfig.level) return;

    const formattedMessage = this.formatMessage(levelName, message);
    const color = this.envonfig.colors
      ? this.envolors[levelName as keyof typeof this.envolors]
      : '';
    const reset = this.envonfig.colors ? this.envolors.reset : '';

    if (data !== undefined) {
      console.log(`${color}${formattedMessage}${reset}`, data);
    } else {
      console.log(`${color}${formattedMessage}${reset}`);
    }
  }

  error(message: string, error?: Error | any) {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, 'error', `${message}: ${error.message}`);
      if (this.envonfig.level >= LogLevel.DEBUG) {
        console.error(error.stack);
      }
    } else if (error) {
      this.log(LogLevel.ERROR, 'error', message, error);
    } else {
      this.log(LogLevel.ERROR, 'error', message);
    }
  }

  critical(message: string, data?: any) {
    this.log(LogLevel.CRITICAL, 'critical', message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, 'warn', message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, 'info', message, data);
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, 'debug', message, data);
  }

  createChild(prefix: string): Logger {
    return new Logger({
      ...this.envonfig,
      prefix: this.envonfig.prefix ? `${this.envonfig.prefix}:${prefix}` : prefix,
    });
  }
}

// Create default logger instance
const defaultConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ||
      LogLevel.ERROR
    : process.env.NODE_ENV === 'production'
      ? LogLevel.ERROR
      : LogLevel.INFO,
  timestamp: process.env.LOG_TIMESTAMP !== 'false',
  colors:
    process.env.LOG_COLORS !== 'false' && process.env.NODE_ENV !== 'production',
};

export const logger = new Logger(defaultConfig);

// Helper to create a logger for a specific component
export function createLogger(prefix: string): Logger {
  return logger.createChild(prefix);
}
