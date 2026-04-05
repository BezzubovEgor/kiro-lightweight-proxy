# Kiro Lightweight Proxy

Minimal OpenAI-compatible proxy for Kiro AI with AWS Builder ID OAuth support.

**Features:**
- ✅ AWS Builder ID OAuth device flow (interactive login)
- ✅ Automatic token refresh (5 min before expiry)
- ✅ OpenAI `/v1/chat/completions` API compatible
- ✅ AWS EventStream binary parser with CRC32 validation
- ✅ Streaming support (SSE)
- ✅ Request timeouts & retry logic
- ✅ Request size limits
- ✅ Optional API key authentication
- ✅ Optional rate limiting
- ✅ Async file I/O (non-blocking)
- ✅ Minimal dependencies (only `uuid`)
- ✅ ~50 MB RAM usage
- ✅ Works on 1GB RAM machines

## Installation

```bash
git clone https://github.com/BezzubovEgor/kiro-lightweight-proxy.git
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

### 2. Start Proxy Server

```bash
node server.js
```

### 3. Use with OpenClaw (or any OpenAI client)

Configure OpenClaw:
- **Base URL:** `http://localhost:3000`
- **Model:** `claude-sonnet-4.5`
- **API Key:** (leave empty, unless you set PROXY_API_KEY)

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

## Configuration

All configuration via environment variables:

```bash
# Server
PORT=3000                          # Server port (default: 3000)

# Timeouts
REQUEST_TIMEOUT_MS=30000           # Request timeout (default: 30s)
TOKEN_REFRESH_BUFFER_MS=300000     # Token refresh buffer (default: 5min)

# Limits
MAX_REQUEST_SIZE=1048576           # Max request size (default: 1MB)

# Authentication (optional)
PROXY_API_KEY=your-secret-key      # Enable API key auth

# Rate Limiting (optional)
RATE_LIMIT_ENABLED=true            # Enable rate limiting
RATE_LIMIT_MAX=60                  # Max requests per window
RATE_LIMIT_WINDOW_MS=60000         # Rate limit window (default: 1min)

# Retry
MAX_RETRIES=3                      # Max retry attempts (default: 3)
RETRY_DELAY_MS=1000                # Initial retry delay (default: 1s)

# Kiro API (advanced)
KIRO_API_BASE=https://...          # Override Kiro API base URL
```

**Example with authentication:**
```bash
PROXY_API_KEY=my-secret-key node server.js
```

Then use in requests:
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer my-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4.5", "messages": [...]}'
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

### GET /health

Health check endpoint with token status.

## Architecture

```
kiro-lightweight-proxy/
├── src/
│   ├── config.js            # Configuration
│   ├── oauth.js             # AWS Builder ID OAuth flow
│   ├── token-manager.js     # Token storage + auto-refresh
│   ├── translator.js        # OpenAI → Kiro format conversion
│   ├── eventstream-parser.js # AWS EventStream → OpenAI SSE
│   ├── http-helper.js       # Fetch with timeout & retry
│   └── rate-limiter.js      # Rate limiting
├── server.js                # Main HTTP server + CLI
├── test.js                  # Component tests
├── examples.js              # Usage examples
└── package.json
```

**Total:** ~900 lines of code, 1 dependency

## Performance Features

- ✅ **Request timeouts** - Prevents hanging connections (30s default)
- ✅ **Retry with exponential backoff** - Handles transient failures (3 retries)
- ✅ **Request size limits** - Prevents memory exhaustion (1MB default)
- ✅ **Async file I/O** - Non-blocking token operations
- ✅ **Token refresh deduplication** - Prevents concurrent refresh storms
- ✅ **Memory + disk caching** - Fast token access
- ✅ **CRC32 validation** - Ensures data integrity
- ✅ **Optional rate limiting** - Protects against abuse
- ✅ **Optional authentication** - Secures proxy access

## Comparison with Other Proxies

| Feature | This Proxy | Colin3191 | heimanba | OmniRoute |
|---------|-----------|-----------|----------|-----------|
| OAuth Login | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| RAM Usage | ~50 MB | ~50 MB | ~30 MB | ~300 MB |
| Dependencies | 1 (uuid) | 2 | 5+ | 50+ |
| Runtime | Node.js | Node.js | Bun | Node.js |
| Lines of Code | ~900 | ~500 | ~800 | ~50,000 |
| Request Timeouts | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| Retry Logic | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| Rate Limiting | ✅ Optional | ❌ No | ❌ No | ✅ Yes |
| Authentication | ✅ Optional | ❌ No | ❌ No | ✅ Yes |
| Async File I/O | ✅ Yes | ❌ No | ❌ No | ✅ Yes |

## Troubleshooting

### "No token found"
Run `node server.js --login` to authenticate.

### "Token expired"
The proxy automatically refreshes tokens. If refresh fails, run `node server.js --login` again.

### "Request timeout"
Increase timeout: `REQUEST_TIMEOUT_MS=60000 node server.js`

### "Request too large"
Increase limit: `MAX_REQUEST_SIZE=2097152 node server.js`

### "Too many requests"
Rate limiting is active. Wait or disable: `RATE_LIMIT_ENABLED=false node server.js`

### Check token status
```bash
node server.js --info
```

### Clear token and re-login
```bash
node server.js --logout
node server.js --login
```

## Development

```bash
# Run tests
node test.js

# Show examples
node examples.js

# Start with debug logging
DEBUG=* node server.js
```

## License

MIT
