import pino from 'pino';
import { config, isProd } from '../config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.verificationCode', '*.cardCode'],
  ...(isProd ? {} : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
});
