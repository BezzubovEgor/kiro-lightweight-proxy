/**
 * Configuration - Centralized settings
 */

export default {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  
  // Kiro API
  kiroApiBase: process.env.KIRO_API_BASE || 'https://codewhisperer.us-east-1.amazonaws.com',
  
  // Timeouts
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'), // 30s
  tokenRefreshBuffer: parseInt(process.env.TOKEN_REFRESH_BUFFER_MS || '300000'), // 5min
  
  // Limits
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '1048576'), // 1MB
  
  // Auth (optional)
  proxyApiKey: process.env.PROXY_API_KEY,
  
  // Rate limiting (optional)
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '60'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1min
  },
  
  // Retry
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.RETRY_DELAY_MS || '1000'),
};
