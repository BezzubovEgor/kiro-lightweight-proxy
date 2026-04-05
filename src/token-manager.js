#!/usr/bin/env node
/**
 * Token Manager - Handles token storage, caching, and auto-refresh
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { refreshToken } from './oauth.js';

const TOKEN_FILE = path.join(os.homedir(), '.kiro-proxy', 'token.json');
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

let cachedToken = null;
let refreshPromise = null;

/**
 * Ensure token directory exists
 */
function ensureTokenDir() {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save token to disk
 */
export function saveToken(tokenData) {
  ensureTokenDir();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
  cachedToken = tokenData;
  console.log(`💾 Token saved to ${TOKEN_FILE}`);
}

/**
 * Load token from disk
 */
export function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load token:', error.message);
    return null;
  }
}

/**
 * Check if token is expired or about to expire
 */
function isTokenExpired(tokenData) {
  if (!tokenData?.expiresAt) return true;
  return new Date(tokenData.expiresAt).getTime() < Date.now() + REFRESH_BUFFER_MS;
}

/**
 * Get valid access token (with auto-refresh)
 */
export async function getAccessToken() {
  // 1. Check memory cache
  if (cachedToken && !isTokenExpired(cachedToken)) {
    return cachedToken.accessToken;
  }

  // 2. Load from disk
  let tokenData = cachedToken || loadToken();
  
  if (!tokenData) {
    throw new Error('No token found. Please run: node server.js --login');
  }

  // 3. Check if expired
  if (!isTokenExpired(tokenData)) {
    cachedToken = tokenData;
    return tokenData.accessToken;
  }

  // 4. Need to refresh
  if (!tokenData.refreshToken) {
    throw new Error('Token expired and no refresh token available. Please login again.');
  }

  // 5. Deduplicate concurrent refresh calls
  if (refreshPromise) {
    console.log('⏳ Waiting for ongoing token refresh...');
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      console.log(`🔄 Token expired (${tokenData.expiresAt}), refreshing...`);
      
      const newTokens = await refreshToken(
        tokenData.refreshToken,
        tokenData.clientId,
        tokenData.clientSecret,
        tokenData.authMethod
      );

      const expiresAt = new Date(Date.now() + newTokens.expiresIn * 1000).toISOString();
      
      const updatedToken = {
        ...tokenData,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || tokenData.refreshToken,
        expiresAt,
      };

      saveToken(updatedToken);
      console.log(`✅ Token refreshed, new expiry: ${expiresAt}`);
      
      return updatedToken.accessToken;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      
      // If old token hasn't fully expired yet, use it
      if (tokenData.expiresAt && new Date(tokenData.expiresAt) > new Date()) {
        console.warn('⚠️  Using existing token despite refresh failure');
        cachedToken = tokenData;
        return tokenData.accessToken;
      }
      
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Get token info for display
 */
export function getTokenInfo() {
  const tokenData = cachedToken || loadToken();
  if (!tokenData) return null;

  const expiresAt = new Date(tokenData.expiresAt);
  const now = new Date();
  const isExpired = expiresAt < now;
  const timeLeft = isExpired ? 0 : Math.floor((expiresAt - now) / 1000 / 60);

  return {
    authMethod: tokenData.authMethod || 'unknown',
    expiresAt: tokenData.expiresAt,
    isExpired,
    timeLeftMinutes: timeLeft,
  };
}

/**
 * Clear token (logout)
 */
export function clearToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
  cachedToken = null;
  console.log('🗑️  Token cleared');
}
