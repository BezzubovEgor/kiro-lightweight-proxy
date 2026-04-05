/**
 * HTTP Helper - Fetch with timeout and retry
 */
import config from './config.js';

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = config.requestTimeout) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch with retry and exponential backoff
 */
export async function fetchWithRetry(url, options = {}, maxRetries = config.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // Don't retry client errors (4xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(config.retryDelay * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
