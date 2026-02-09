export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Log level priority for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

// Get minimum log level from environment (defaults to DEBUG in dev, INFO in prod)
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && envLevel in LogLevel) {
    return envLevel as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
}

// Use structured JSON output in production for log aggregation
function isJsonMode(): boolean {
  return process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production";
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  traceId?: string;
}

export class Logger {
  private minLevel: LogLevel;
  private jsonMode: boolean;

  constructor(private category: string) {
    this.minLevel = getMinLogLevel();
    this.jsonMode = isJsonMode();
  }

  debug(message: string, data?: any, traceId?: string) {
    this.log(LogLevel.DEBUG, message, data, traceId);
  }

  info(message: string, data?: any, traceId?: string) {
    this.log(LogLevel.INFO, message, data, traceId);
  }

  warn(message: string, data?: any, traceId?: string) {
    this.log(LogLevel.WARN, message, data, traceId);
  }

  error(message: string, data?: any, traceId?: string) {
    this.log(LogLevel.ERROR, message, data, traceId);
  }

  private log(level: LogLevel, message: string, data?: any, traceId?: string) {
    // Filter by minimum log level
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: this.category,
      message,
      data,
      traceId
    };
    
    if (this.jsonMode) {
      // Structured JSON output for production log aggregation
      const jsonEntry = {
        ...entry,
        data: entry.data ? safeSerialize(entry.data) : undefined,
      };
      const output = level === LogLevel.ERROR ? console.error : console.log;
      output(JSON.stringify(jsonEntry));
    } else {
      // Console output with color coding for development
      const colors = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
      };
      
      const output = level === LogLevel.ERROR ? console.error : console.log;
      output(
        `${colors[level]}[${entry.timestamp}] [${entry.level}] [${entry.category}]${traceId ? ` [${traceId}]` : ''} ${entry.message}\x1b[0m`,
        entry.data ? entry.data : ''
      );
    }
  }
}

/**
 * Safely serialize data for JSON logging, handling circular references and errors
 */
function safeSerialize(data: any): any {
  try {
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }
    // Test for circular references
    JSON.stringify(data);
    return data;
  } catch {
    return String(data);
  }
}

// Create loggers for different components
export const createLogger = (category: string) => new Logger(category);
