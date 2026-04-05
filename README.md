# Kiro Lightweight Proxy

A minimal OpenAI-compatible proxy for Kiro AI with AWS Builder ID OAuth support.

## Features

- AWS Builder ID OAuth 2.0 device flow authentication
- Automatic token refresh with configurable buffer
- OpenAI `/v1/chat/completions` API compatibility
- AWS EventStream binary protocol parser with CRC32 validation
- Server-Sent Events (SSE) streaming support
- Request timeout handling
- Exponential backoff retry logic
- Request size limits
- Optional API key authentication
- Optional rate limiting
- Asynchronous file I/O
- Single dependency (uuid)

## Requirements

- Node.js >= 18.0.0
- npm or compatible package manager

## Installation

```bash
git clone https://github.com/BezzubovEgor/kiro-lightweight-proxy.git
cd kiro-lightweight-proxy
npm install
```

## Usage

### Authentication

Initiate OAuth flow with AWS Builder ID:

```bash
node server.js --login
```

The process will:
1. Register an OAuth client with AWS SSO
2. Display a verification URL and code
3. Wait for user authorization
4. Store credentials in `~/.kiro-proxy/token.json`

### Starting the Server

```bash
node server.js
```

Default port: 3000

### CLI Commands

```bash
node server.js --login    # Start OAuth authentication flow
node server.js            # Start proxy server
node server.js --info     # Display token information
node server.js --logout   # Clear stored credentials
node server.js --help     # Show help message
```

## Configuration

Configuration is managed through environment variables:

### Server Configuration

```bash
PORT=3000                          # Server port
```

### Timeout Configuration

```bash
REQUEST_TIMEOUT_MS=30000           # Request timeout in milliseconds
TOKEN_REFRESH_BUFFER_MS=300000     # Token refresh buffer in milliseconds
```

### Limit Configuration

```bash
MAX_REQUEST_SIZE=1048576           # Maximum request size in bytes
```

### Authentication Configuration

```bash
PROXY_API_KEY=your-secret-key      # Enable API key authentication
```

### Rate Limiting Configuration

```bash
RATE_LIMIT_ENABLED=true            # Enable rate limiting
RATE_LIMIT_MAX=60                  # Maximum requests per window
RATE_LIMIT_WINDOW_MS=60000         # Rate limit window in milliseconds
```

### Retry Configuration

```bash
MAX_RETRIES=3                      # Maximum retry attempts
RETRY_DELAY_MS=1000                # Initial retry delay in milliseconds
```

### Advanced Configuration

```bash
KIRO_API_BASE=https://...          # Override Kiro API base URL
```

## API Endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

**Request:**
```json
{
  "model": "claude-sonnet-4.5",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "max_tokens": 4096,
  "temperature": 0.7,
  "top_p": 0.9
}
```

**Response:** Server-Sent Events stream with OpenAI-formatted chunks

### GET /v1/models

Returns list of available models.

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

Health check endpoint with token status.

**Response:**
```json
{
  "status": "ok",
  "authMethod": "builder-id",
  "expiresAt": "2026-04-05T17:00:00.000Z",
  "timeLeftMinutes": 60
}
```

## Supported Models

- claude-sonnet-4.5
- claude-haiku-4.5
- claude-opus-4.6

## Client Integration

### cURL Example

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### With Authentication

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="not-required"
)

response = client.chat.completions.create(
    model="claude-sonnet-4.5",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### Node.js Example

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'not-required',
});

const stream = await client.chat.completions.create({
  model: 'claude-sonnet-4.5',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Architecture

```
kiro-lightweight-proxy/
├── src/
│   ├── config.js            # Configuration management
│   ├── oauth.js             # AWS Builder ID OAuth implementation
│   ├── token-manager.js     # Token storage and refresh logic
│   ├── translator.js        # OpenAI to Kiro format conversion
│   ├── eventstream-parser.js # AWS EventStream binary parser
│   ├── http-helper.js       # HTTP utilities with timeout and retry
│   └── rate-limiter.js      # Rate limiting implementation
├── server.js                # HTTP server and CLI interface
├── test.js                  # Component tests
└── package.json             # Dependencies
```

## Technical Details

### Authentication Flow

1. Client registration with AWS SSO OIDC
2. Device authorization request
3. User authorization via browser
4. Token polling with configurable interval
5. Token storage with automatic refresh

### Request Processing

1. Request validation and size check
2. Optional authentication verification
3. Optional rate limit check
4. Token retrieval with automatic refresh
5. Format translation (OpenAI to Kiro)
6. API request with timeout and retry
7. Binary response parsing (AWS EventStream)
8. Format translation (Kiro to OpenAI)
9. SSE stream response

### Error Handling

- Request timeout after configurable duration
- Exponential backoff retry for transient failures
- Graceful token refresh with fallback to existing token
- CRC32 validation for binary protocol integrity
- Comprehensive error messages with context

## Performance Characteristics

- Memory usage: ~50 MB
- Request timeout: 30 seconds (configurable)
- Retry attempts: 3 (configurable)
- Token refresh buffer: 5 minutes (configurable)
- Maximum request size: 1 MB (configurable)
- Rate limit window: 60 seconds (configurable)

## Security Features

- Optional API key authentication via Bearer token
- Per-IP rate limiting with configurable thresholds
- Request size limits to prevent resource exhaustion
- Automatic token refresh with secure storage
- CRC32 validation for data integrity

## Troubleshooting

### No Token Found

Execute authentication flow:
```bash
node server.js --login
```

### Token Expired

Tokens refresh automatically. If refresh fails, re-authenticate:
```bash
node server.js --login
```

### Request Timeout

Increase timeout duration:
```bash
REQUEST_TIMEOUT_MS=60000 node server.js
```

### Request Size Exceeded

Increase size limit:
```bash
MAX_REQUEST_SIZE=2097152 node server.js
```

### Rate Limit Exceeded

Adjust rate limit configuration:
```bash
RATE_LIMIT_MAX=100 RATE_LIMIT_WINDOW_MS=60000 node server.js
```

### Token Status Check

```bash
node server.js --info
```

## Development

### Running Tests

```bash
node test.js
```

### Viewing Examples

```bash
node examples.js
```

## Dependencies

- uuid (^10.0.0) - UUID generation for deterministic caching

## License

MIT

## Repository

https://github.com/BezzubovEgor/kiro-lightweight-proxy
