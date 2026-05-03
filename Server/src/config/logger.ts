import fs from 'fs';
import path from 'path';
import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;
const LOG_DIR = path.resolve(process.cwd(), 'logs');

fs.mkdirSync(LOG_DIR, { recursive: true });

const logFormat = printf(({ level, message, timestamp, stack }) => {
  const msg = typeof message === 'object' ? JSON.stringify(message) : message;
  return `${timestamp} ${level}: ${stack || msg}`;
});

export const logger = {
  info: (message: string | object, ...args: any[]) => {
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, ...args);
  },
  error: (message: string | object, ...args: any[]) => {
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, ...args);
  },
  warn: (message: string | object, ...args: any[]) => {
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    console.warn(`[${new Date().toISOString()}] [WARN] ${msg}`, ...args);
  },
  debug: (message: string | object, ...args: any[]) => {
    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
    console.debug(`[${new Date().toISOString()}] [DEBUG] ${msg}`, ...args);
  },
};

export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    ...(process.env.NODE_ENV === 'development'
      ? [
          new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
          new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
        ]
      : []),
  ],
});
