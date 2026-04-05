# Kiro Lightweight Proxy

OpenAI-compatible proxy for Kiro AI with AWS Builder ID authentication.

## Quick Start

```bash
git clone https://github.com/BezzubovEgor/kiro-lightweight-proxy.git
cd kiro-lightweight-proxy
npm install
node server.js --login  # Follow browser instructions
node server.js          # Server starts on port 3000
```

Use with any OpenAI client:
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4.5", "messages": [{"role": "user", "content": "Hello"}]}'
```

## How It Works

### Authentication Flow

```
┌─────────┐                                    ┌──────────────┐
│  User   │                                    │  AWS SSO     │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │  1. node server.js --login                    │
     │────────────────────────────────────────►      │
     │                                                │
     │  2. Register OAuth client                     │
     │───────────────────────────────────────────────►
     │                                                │
     │  3. Get device code + verification URL        │
     │◄───────────────────────────────────────────────
     │                                                │
     │  4. Open URL in browser                       │
     │  https://device.sso.../ABCD-1234              │
     │                                                │
     │  5. Authorize                                 │
     │───────────────────────────────────────────────►
     │                                                │
     │  6. Poll for token                            │
     │───────────────────────────────────────────────►
     │                                                │
     │  7. Return access + refresh tokens            │
     │◄───────────────────────────────────────────────
     │                                                │
     │  8. Save to ~/.kiro-proxy/token.json          │
     │                                                │
```

### Request Flow

```
┌────────────┐         ┌───────────┐         ┌──────────────┐
│   Client   │         │   Proxy   │         │   Kiro API   │
└─────┬──────┘         └─────┬─────┘         └──────┬───────┘
      │                      │                       │
      │  OpenAI format       │                       │
      │  POST /v1/chat/...   │                       │
      │─────────────────────►│                       │
      │                      │                       │
      │                      │  1. Get/refresh token │
      │                      │                       │
      │                      │  2. Translate format  │
      │                      │     OpenAI → Kiro     │
      │                      │                       │
      │                      │  3. Send request      │
      │                      │──────────────────────►│
      │                      │                       │
      │                      │  4. Binary response   │
      │                      │     (EventStream)     │
      │                      │◄──────────────────────│
      │                      │                       │
      │                      │  5. Parse binary      │
      │                      │     + validate CRC32  │
      │                      │                       │
      │                      │  6. Translate format  │
      │                      │     Kiro → OpenAI     │
      │                      │                       │
      │  OpenAI SSE stream   │                       │
      │◄─────────────────────│                       │
      │                      │                       │
```

### Token Refresh

```
Time ──────────────────────────────────────────────────►

Token issued                    5min before expiry      Token expires
     │                                 │                      │
     ├─────────────────────────────────┼──────────────────────┤
     │         Valid period            │   Refresh window     │
     │                                 │                      │
     │                                 ▼                      │
     │                          Auto-refresh                  │
     │                          triggered                     │
     │                                 │                      │
     │                                 ├──► New token         │
     │                                 │    issued            │
     │                                 │                      │
     └─────────────────────────────────┴──────────────────────┘
```

## Configuration

Create `.env` file or set environment variables:

```bash
# Server
PORT=3000

# Optional: Authentication
PROXY_API_KEY=your-secret-key

# Optional: Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=60

# Timeouts (milliseconds)
REQUEST_TIMEOUT_MS=30000
TOKEN_REFRESH_BUFFER_MS=300000

# Limits (bytes)
MAX_REQUEST_SIZE=1048576
```

## Commands

```bash
node server.js --login    # Authenticate with AWS Builder ID
node server.js            # Start server
node server.js --info     # Show token status
node server.js --logout   # Clear credentials
```

## API Endpoints

### POST /v1/chat/completions

Standard OpenAI chat completions endpoint.

### GET /v1/models

List available models.

### GET /health

Server and token status.

## Supported Models

- claude-sonnet-4.5
- claude-haiku-4.5
- claude-opus-4.6

## Examples

### Python

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="not-needed")
response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)
```

### Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'not-needed'
});

const stream = await client.chat.completions.create({
  model: 'claude-sonnet-4.5',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true
});
```

## Architecture

```
src/
├── config.js              # Configuration
├── oauth.js               # AWS Builder ID OAuth
├── token-manager.js       # Token storage & refresh
├── translator.js          # Format conversion
├── eventstream-parser.js  # Binary protocol parser
├── http-helper.js         # Timeout & retry
└── rate-limiter.js        # Rate limiting

server.js                  # HTTP server + CLI
```

## Features

- AWS Builder ID OAuth 2.0 device flow
- Automatic token refresh
- OpenAI API compatibility
- Binary protocol parsing with CRC32 validation
- Request timeouts (30s)
- Retry with exponential backoff (3 attempts)
- Request size limits (1MB)
- Optional API key authentication
- Optional rate limiting
- Async file operations

## Requirements

- Node.js >= 18.0.0
- 1 dependency (uuid)

## License

MIT
