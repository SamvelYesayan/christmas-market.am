import pino from 'pino';
import { config, isProd } from '../config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'headers.authorization', '*.password', '*.verificationCode', '*.cardCode', '*.cardNumber', '*.cvv', '*.apiKey', '*.MAGICAL_PIONEER_API_KEY'],
  ...(isProd ? {} : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
});
