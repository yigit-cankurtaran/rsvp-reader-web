/**
 * Logger utility for the application.
 * Only logs in development mode (when import.meta.env.DEV is true).
 */

const isDevelopment = import.meta.env.DEV;

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

class ConsoleLogger implements Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', ...args: any[]) {
    if (!isDevelopment) return;
    const consoleMethod = console[level];
    if (typeof consoleMethod === 'function') {
      consoleMethod(`[${this.module}]`, ...args);
    }
  }

  debug(...args: any[]) {
    this.log('debug', ...args);
  }

  info(...args: any[]) {
    this.log('info', ...args);
  }

  warn(...args: any[]) {
    this.log('warn', ...args);
  }

  error(...args: any[]) {
    this.log('error', ...args);
  }
}

const logger = {
  forModule: (moduleName: string): Logger => new ConsoleLogger(moduleName)
};

export default logger; 