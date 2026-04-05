/**
 * Rate Limiter - Simple in-memory rate limiting
 */
import config from './config.js';

class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  check(clientId) {
    if (!config.rateLimit.enabled) return true;
    
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const validRequests = clientRequests.filter(
      time => now - time < config.rateLimit.windowMs
    );
    
    if (validRequests.length >= config.rateLimit.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [clientId, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        time => now - time < config.rateLimit.windowMs
      );
      if (validRequests.length === 0) {
        this.requests.delete(clientId);
      } else {
        this.requests.set(clientId, validRequests);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
