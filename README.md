# Kiro Lightweight Proxy

Minimal OpenAI-compatible proxy for Kiro AI with AWS Builder ID OAuth support.

**Features:**
- ✅ AWS Builder ID OAuth device flow (interactive login)
- ✅ Automatic token refresh (5 min before expiry)
- ✅ OpenAI `/v1/chat/completions` API compatible
- ✅ AWS EventStream binary parser with CRC32 validation
- ✅ Streaming support (SSE)
- ✅ Minimal dependencies (only `uuid`)
- ✅ ~50 MB RAM usage
- ✅ Works on 1GB RAM machines

## Installation

```bash
cd kiro-lightweight-proxy
npm install
```

## Quick Start

### 1. Login with AWS Builder ID

```bash
node server.js --login
```

This will:
1. Register OAuth client with AWS SSO
2. Show you a URL and code
3. Wait for you to authorize in browser
4. Save tokens to `~/.kiro-proxy/token.json`

**Example output:**
```
🔐 Starting AWS Builder ID OAuth flow...

1️⃣  Registering OAuth client...
✅ Client registered

2️⃣  Starting device authorization...
✅ Device authorization started

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 AUTHORIZATION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Open this URL in your browser:
   https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-1234

🔑 Or go to: https://device.sso.us-east-1.amazonaws.com/
   And enter code: ABCD-1234

⏳ Waiting for authorization...

✅ Authorization successful!

💾 Token saved to /Users/you/.kiro-proxy/token.json
```

### 2. Start Proxy Server

```bash
node server.js
```

**Example output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Kiro Lightweight Proxy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Server running on http://localhost:3000

📋 Endpoints:
   POST http://localhost:3000/v1/chat/completions
   GET  http://localhost:3000/v1/models
   GET  http://localhost:3000/health

🔐 Token Status:
   Auth Method: builder-id
   Expires: 2026-04-05T17:42:15.038Z
   Time Left: 60 minutes
   Status: ✅ Valid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Use with OpenClaw (or any OpenAI client)

Configure OpenClaw:
- **Base URL:** `http://localhost:3000`
- **Model:** `claude-sonnet-4.5`
- **API Key:** (not required)

**Test with curl:**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

## CLI Commands

```bash
# Login with AWS Builder ID
node server.js --login

# Start proxy server
node server.js

# Show token info
node server.js --info

# Logout (clear token)
node server.js --logout

# Show help
node server.js --help
```

## Environment Variables

```bash
# Server port (default: 3000)
PORT=8080 node server.js
```

## Supported Models

- `claude-sonnet-4.5` (default)
- `claude-haiku-4.5`
- `claude-opus-4.6`

## API Endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

**Request:**
```json
{
  "model": "claude-sonnet-4.5",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "max_tokens": 4096,
  "temperature": 0.7
}
```

**Response:** SSE stream with OpenAI format chunks

### GET /v1/models

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {"id": "claude-sonnet-4.5", "object": "model", "owned_by": "anthropic"},
    {"id": "claude-haiku-4.5", "object": "model", "owned_by": "anthropic"},
    {"id": "claude-opus-4.6", "object": "model", "owned_by": "anthropic"}
  ]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "authMethod": "builder-id",
  "expiresAt": "2026-04-05T17:42:15.038Z",
  "timeLeftMinutes": 60
}
```

## How It Works

### 1. OAuth Flow (AWS Builder ID)

```
┌─────────────┐
│ node server │
│   --login   │
└──────┬──────┘
       │
       ├─► Register OAuth client
       │   POST https://oidc.us-east-1.amazonaws.com/client/register
       │   Returns: clientId, clientSecret
       │
       ├─► Start device authorization
       │   POST https://oidc.us-east-1.amazonaws.com/device_authorization
       │   Returns: deviceCode, userCode, verificationUri
       │
       ├─► User opens URL in browser
       │   https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-1234
       │   User signs in with AWS Builder ID
       │
       ├─► Poll for token (every 5 seconds)
       │   POST https://oidc.us-east-1.amazonaws.com/token
       │   Returns: accessToken, refreshToken, expiresIn
       │
       └─► Save token to ~/.kiro-proxy/token.json
```

### 2. Request Flow

```
┌──────────┐      ┌───────────┐      ┌─────────────┐
│ OpenClaw │─────►│   Proxy   │─────►│  Kiro API   │
└──────────┘      └───────────┘      └─────────────┘
  OpenAI            Translate          AWS EventStream
  format            format              binary format
                    
                    ├─► Get access token (auto-refresh if needed)
                    ├─► Convert OpenAI → Kiro format
                    ├─► Call Kiro API
                    ├─► Parse AWS EventStream binary
                    └─► Convert to OpenAI SSE format
```

### 3. Token Refresh

Tokens are automatically refreshed 5 minutes before expiry:

```
┌─────────────┐
│ getToken()  │
└──────┬──────┘
       │
       ├─► Check memory cache
       │   └─► Valid? Return token
       │
       ├─► Load from disk
       │   └─► Valid? Return token
       │
       ├─► Token expired?
       │   └─► Refresh token
       │       POST https://oidc.us-east-1.amazonaws.com/token
       │       grantType: refresh_token
       │
       └─► Save new token to disk
```

## Architecture

```
server.js              # HTTP server + CLI
├── oauth.js           # AWS Builder ID OAuth flow
├── token-manager.js   # Token storage + auto-refresh
├── translator.js      # OpenAI → Kiro format conversion
└── eventstream-parser.js  # AWS EventStream → OpenAI SSE
```

**Total size:** ~500 lines of code, 5 files, 1 dependency

## Comparison with Other Proxies

| Feature | This Proxy | Colin3191 | heimanba | OmniRoute |
|---------|-----------|-----------|----------|-----------|
| OAuth Login | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| RAM Usage | ~50 MB | ~50 MB | ~30 MB | ~300 MB |
| Dependencies | 1 (uuid) | 2 | 5+ | 50+ |
| Runtime | Node.js | Node.js | Bun | Node.js |
| Lines of Code | ~500 | ~500 | ~800 | ~50,000 |
| Auto-refresh | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Web UI | ❌ No | ❌ No | ❌ No | ✅ Yes |

## Troubleshooting

### "No token found"
Run `node server.js --login` to authenticate.

### "Token expired"
The proxy automatically refreshes tokens. If refresh fails, run `node server.js --login` again.

### "Authorization timeout"
The device code expires after 10 minutes. Run `node server.js --login` again.

### Check token status
```bash
node server.js --info
```

### Clear token and re-login
```bash
node server.js --logout
node server.js --login
```

## License

MIT
