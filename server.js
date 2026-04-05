#!/usr/bin/env node
/**
 * Kiro Lightweight Proxy Server
 * Minimal proxy with AWS Builder ID OAuth support
 * 
 * Usage:
 *   node server.js --login    # Start OAuth login flow
 *   node server.js            # Start proxy server
 *   node server.js --info     # Show token info
 *   node server.js --logout   # Clear token
 */

import http from 'http';
import { completeOAuthFlow } from './src/oauth.js';
import { getAccessToken, saveToken, getTokenInfo, clearToken, loadToken } from './src/token-manager.js';
import { buildKiroPayload } from './src/translator.js';
import { parseEventStreamToOpenAI, chunksToSSE } from './src/eventstream-parser.js';
import { fetchWithTimeout } from './src/http-helper.js';
import { rateLimiter } from './src/rate-limiter.js';
import config from './src/config.js';

/**
 * Get client IP for rate limiting
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.socket.remoteAddress || 
         'unknown';
}

/**
 * Authenticate request (optional)
 */
function authenticate(req) {
  if (!config.proxyApiKey) return true; // Auth disabled
  
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '');
  return apiKey === config.proxyApiKey;
}

/**
 * Call Kiro API
 */
async function callKiroAPI(payload, accessToken) {
  const response = await fetchWithTimeout(`${config.kiroApiBase}/generateAssistantResponse`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.amazon.eventstream',
      'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
      'User-Agent': 'AWS-SDK-JS/3.0.0 kiro-proxy/1.0.0',
      'X-Amz-User-Agent': 'aws-sdk-js/3.0.0 kiro-proxy/1.0.0',
    },
    body: JSON.stringify(payload),
  });

  return response;
}

/**
 * Handle /v1/chat/completions endpoint
 */
async function handleChatCompletions(req, res) {
  let body = '';
  let bodySize = 0;
  
  req.on('data', chunk => {
    bodySize += chunk.length;
    if (bodySize > config.maxRequestSize) {
      req.destroy();
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Request too large' } }));
      return;
    }
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const openaiRequest = JSON.parse(body);
      const model = openaiRequest.model || 'claude-sonnet-4.5';
      const stream = openaiRequest.stream !== false; // Default to streaming

      if (!stream) {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Non-streaming mode not supported yet' } }));
        return;
      }

      // Get access token (with auto-refresh)
      const accessToken = await getAccessToken();

      // Translate OpenAI -> Kiro format
      const kiroPayload = buildKiroPayload(openaiRequest, model);

      // Call Kiro API
      const kiroResponse = await callKiroAPI(kiroPayload, accessToken);

      if (!kiroResponse.ok) {
        const errorText = await kiroResponse.text();
        res.writeHead(kiroResponse.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: errorText } }));
        return;
      }

      // Read binary EventStream response
      const buffer = await kiroResponse.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Parse EventStream -> OpenAI chunks
      const chunks = parseEventStreamToOpenAI(uint8Array, model);

      // Convert to SSE format
      const sseData = chunksToSSE(chunks);

      // Send SSE response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.end(sseData);

    } catch (error) {
      console.error('Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
}

/**
 * Handle /v1/models endpoint
 */
async function handleModels(req, res) {
  const models = [
    { id: 'claude-sonnet-4.5', object: 'model', created: 1704067200, owned_by: 'anthropic' },
    { id: 'claude-haiku-4.5', object: 'model', created: 1704067200, owned_by: 'anthropic' },
    { id: 'claude-opus-4.6', object: 'model', created: 1704067200, owned_by: 'anthropic' },
  ];

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ object: 'list', data: models }));
}

/**
 * Handle /health endpoint
 */
async function handleHealth(req, res) {
  try {
    const tokenInfo = await getTokenInfo();
    
    if (!tokenInfo) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'No token found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: tokenInfo.isExpired ? 'token_expired' : 'ok',
      authMethod: tokenInfo.authMethod,
      expiresAt: tokenInfo.expiresAt,
      timeLeftMinutes: tokenInfo.timeLeftMinutes,
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: error.message }));
  }
}

/**
 * Main HTTP server
 */
function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Authentication check
    if (!authenticate(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Unauthorized' } }));
      return;
    }

    // Rate limiting check
    const clientIP = getClientIP(req);
    if (!rateLimiter.check(clientIP)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Too many requests' } }));
      return;
    }

    // Route handling
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      handleChatCompletions(req, res);
    } else if (url.pathname === '/v1/models' && req.method === 'GET') {
      handleModels(req, res);
    } else if (url.pathname === '/health' && req.method === 'GET') {
      handleHealth(req, res);
    } else if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Kiro Lightweight Proxy - Running');
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Not Found' } }));
    }
  });

  server.listen(config.port, () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Kiro Lightweight Proxy');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📡 Server running on http://localhost:${config.port}`);
    console.log('\n📋 Endpoints:');
    console.log(`   POST http://localhost:${config.port}/v1/chat/completions`);
    console.log(`   GET  http://localhost:${config.port}/v1/models`);
    console.log(`   GET  http://localhost:${config.port}/health`);
    
    getTokenInfo().then(tokenInfo => {
      if (tokenInfo) {
        console.log('\n🔐 Token Status:');
        console.log(`   Auth Method: ${tokenInfo.authMethod}`);
        console.log(`   Expires: ${tokenInfo.expiresAt}`);
        console.log(`   Time Left: ${tokenInfo.timeLeftMinutes} minutes`);
        console.log(`   Status: ${tokenInfo.isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
      } else {
        console.log('\n⚠️  No token found. Run: node server.js --login');
      }
      
      if (config.proxyApiKey) {
        console.log('\n🔒 Authentication: Enabled');
      }
      
      if (config.rateLimit.enabled) {
        console.log(`\n⏱️  Rate Limit: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 1000}s`);
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  });
}

/**
 * CLI commands
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--login') {
    // OAuth login flow
    try {
      const tokenData = await completeOAuthFlow();
      await saveToken(tokenData);
      console.log('\n✅ Login successful! You can now start the server.\n');
      console.log('Run: node server.js\n');
    } catch (error) {
      console.error('\n❌ Login failed:', error.message, '\n');
      process.exit(1);
    }
  } else if (command === '--info') {
    // Show token info
    const tokenInfo = await getTokenInfo();
    if (!tokenInfo) {
      console.log('\n❌ No token found. Run: node server.js --login\n');
      process.exit(1);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Token Information');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\nAuth Method: ${tokenInfo.authMethod}`);
    console.log(`Expires At: ${tokenInfo.expiresAt}`);
    console.log(`Time Left: ${tokenInfo.timeLeftMinutes} minutes`);
    console.log(`Status: ${tokenInfo.isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else if (command === '--logout') {
    // Clear token
    await clearToken();
    console.log('\n✅ Logged out successfully\n');
  } else if (command === '--help' || command === '-h') {
    // Show help
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Kiro Lightweight Proxy - Help');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nUsage:');
    console.log('  node server.js --login    Start OAuth login flow');
    console.log('  node server.js            Start proxy server');
    console.log('  node server.js --info     Show token information');
    console.log('  node server.js --logout   Clear token (logout)');
    console.log('  node server.js --help     Show this help message');
    console.log('\nEnvironment Variables:');
    console.log('  PORT                      Server port (default: 3000)');
    console.log('  PROXY_API_KEY             Optional API key for authentication');
    console.log('  RATE_LIMIT_ENABLED        Enable rate limiting (default: false)');
    console.log('  REQUEST_TIMEOUT_MS        Request timeout (default: 30000)');
    console.log('  MAX_REQUEST_SIZE          Max request size (default: 1048576)');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    // Start server (default)
    const token = await loadToken();
    if (!token) {
      console.log('\n❌ No token found. Please login first:\n');
      console.log('   node server.js --login\n');
      process.exit(1);
    }
    
    startServer();
  }
}

main();
