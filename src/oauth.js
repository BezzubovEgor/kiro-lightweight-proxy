#!/usr/bin/env node
/**
 * Kiro OAuth Module - AWS Builder ID Device Flow
 * Handles client registration, device authorization, and token management
 */
import { fetchWithRetry } from './http-helper.js';

const KIRO_CONFIG = {
  // AWS SSO OIDC endpoints
  registerClientUrl: 'https://oidc.us-east-1.amazonaws.com/client/register',
  deviceAuthUrl: 'https://oidc.us-east-1.amazonaws.com/device_authorization',
  tokenUrl: 'https://oidc.us-east-1.amazonaws.com/token',
  startUrl: 'https://view.awsapps.com/start',
  
  // Client registration params
  clientName: 'kiro-lightweight-proxy',
  clientType: 'public',
  scopes: ['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations'],
  grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
  issuerUrl: 'https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6',
  
  // Social auth (optional - for Google/GitHub login)
  socialRefreshUrl: 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken',
};

/**
 * Step 1: Register OAuth client with AWS SSO
 */
export async function registerClient() {
  const response = await fetchWithRetry(KIRO_CONFIG.registerClientUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: KIRO_CONFIG.clientName,
      clientType: KIRO_CONFIG.clientType,
      scopes: KIRO_CONFIG.scopes,
      grantTypes: KIRO_CONFIG.grantTypes,
      issuerUrl: KIRO_CONFIG.issuerUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Client registration failed: ${error}`);
  }

  const data = await response.json();
  return {
    clientId: data.clientId,
    clientSecret: data.clientSecret,
    clientSecretExpiresAt: data.clientSecretExpiresAt,
  };
}

/**
 * Step 2: Start device authorization flow
 */
export async function startDeviceAuthorization(clientId, clientSecret) {
  const response = await fetchWithRetry(KIRO_CONFIG.deviceAuthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
      startUrl: KIRO_CONFIG.startUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Device authorization failed: ${error}`);
  }

  const data = await response.json();
  return {
    deviceCode: data.deviceCode,
    userCode: data.userCode,
    verificationUri: data.verificationUri,
    verificationUriComplete: data.verificationUriComplete,
    expiresIn: data.expiresIn,
    interval: data.interval || 5,
  };
}

/**
 * Step 3: Poll for token (call repeatedly until user authorizes)
 */
export async function pollDeviceToken(clientId, clientSecret, deviceCode) {
  const response = await fetchWithRetry(KIRO_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
      deviceCode,
      grantType: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  }, 1); // Only 1 retry for polling

  const data = await response.json();

  // Handle pending/errors
  if (!response.ok || data.error) {
    return {
      success: false,
      error: data.error,
      pending: data.error === 'authorization_pending' || data.error === 'slow_down',
    };
  }

  return {
    success: true,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken, clientId, clientSecret, authMethod = 'builder-id') {
  // AWS SSO OIDC refresh (Builder ID or IdC)
  if (clientId && clientSecret) {
    const response = await fetchWithRetry(KIRO_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        clientSecret,
        refreshToken,
        grantType: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      expiresIn: data.expiresIn,
    };
  }

  // Social auth refresh (Google/GitHub)
  const response = await fetchWithRetry(KIRO_CONFIG.socialRefreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Social token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken,
    expiresIn: data.expiresIn || 3600,
    profileArn: data.profileArn,
  };
}

/**
 * Complete OAuth flow (interactive CLI)
 */
export async function completeOAuthFlow() {
  console.log('🔐 Starting AWS Builder ID OAuth flow...\n');

  // Step 1: Register client
  console.log('1️⃣  Registering OAuth client...');
  const client = await registerClient();
  console.log('✅ Client registered\n');

  // Step 2: Start device authorization
  console.log('2️⃣  Starting device authorization...');
  const device = await startDeviceAuthorization(client.clientId, client.clientSecret);
  console.log('✅ Device authorization started\n');

  // Step 3: Show user instructions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 AUTHORIZATION REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n🌐 Open this URL in your browser:\n   ${device.verificationUriComplete}\n`);
  console.log(`🔑 Or go to: ${device.verificationUri}`);
  console.log(`   And enter code: ${device.userCode}\n`);
  console.log('⏳ Waiting for authorization...\n');

  // Step 4: Poll for token
  const startTime = Date.now();
  const expiresAt = startTime + device.expiresIn * 1000;
  let attempts = 0;

  while (Date.now() < expiresAt) {
    attempts++;
    const result = await pollDeviceToken(client.clientId, client.clientSecret, device.deviceCode);

    if (result.success) {
      console.log('✅ Authorization successful!\n');
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();
      
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        authMethod: 'builder-id',
      };
    }

    if (!result.pending) {
      throw new Error(`Authorization failed: ${result.error}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, device.interval * 1000));
  }

  throw new Error('Authorization timeout - please try again');
}
