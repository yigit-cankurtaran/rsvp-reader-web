/**
 * Logger utility for the application.
 * Only logs in development mode (when import.meta.env.DEV is true).
 */

// Check if we're in development mode
const isDev = import.meta.env.DEV === true;

// Log levels
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Main logger object
const logger = {
  /**
   * Log information messages
   * @param message The message to log
   * @param data Optional data to include
   */
  info: (message: string, ...data: any[]) => {
    if (isDev) {
      console.info(`📘 [INFO] ${message}`, ...data);
    }
  },

  /**
   * Log warning messages
   * @param message The warning message
   * @param data Optional data to include
   */
  warn: (message: string, ...data: any[]) => {
    if (isDev) {
      console.warn(`⚠️ [WARN] ${message}`, ...data);
    }
  },

  /**
   * Log error messages (these will always be logged, even in production)
   * @param message The error message
   * @param data Optional data to include
   */
  error: (message: string, ...data: any[]) => {
    // Errors are always logged, even in production
    console.error(`❌ [ERROR] ${message}`, ...data);
  },

  /**
   * Log debug messages (only in development)
   * @param message The debug message
   * @param data Optional data to include
   */
  debug: (message: string, ...data: any[]) => {
    if (isDev) {
      console.debug(`🔍 [DEBUG] ${message}`, ...data);
    }
  },

  /**
   * Create a logger for a specific module
   * @param moduleName The module name to prepend to logs
   * @returns A logger instance for the module
   */
  forModule: (moduleName: string) => {
    return {
      info: (message: string, ...data: any[]) => 
        logger.info(`[${moduleName}] ${message}`, ...data),
      warn: (message: string, ...data: any[]) => 
        logger.warn(`[${moduleName}] ${message}`, ...data),
      error: (message: string, ...data: any[]) => 
        logger.error(`[${moduleName}] ${message}`, ...data),
      debug: (message: string, ...data: any[]) => 
        logger.debug(`[${moduleName}] ${message}`, ...data),
    };
  },

  /**
   * Only log in development mode
   * @param callback Function that performs logging
   */
  devOnly: (callback: () => void) => {
    if (isDev) {
      callback();
    }
  }
};

export default logger; 