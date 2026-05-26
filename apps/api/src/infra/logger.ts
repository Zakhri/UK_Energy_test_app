import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'uk-energy-api',
    env: process.env.ENVIRONMENT ?? 'local',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'GEMINI_API_KEY',
      'apiKey',
      '*.apiKey',
      'response.candidates[*].content',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
