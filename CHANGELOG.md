# Changelog

## v2.0.0 - Performance & Reliability Update

### Added
- ✅ **Request timeouts** - 30s default, prevents hanging connections
- ✅ **Retry logic** - Exponential backoff with 3 retries for transient failures
- ✅ **Request size limits** - 1MB default, prevents memory exhaustion
- ✅ **Optional API key authentication** - Secure proxy access with `PROXY_API_KEY`
- ✅ **Optional rate limiting** - Configurable per-IP rate limiting
- ✅ **Async file I/O** - Non-blocking token operations
- ✅ **Configuration system** - Centralized config with environment variables
- ✅ **HTTP helper module** - Reusable fetch with timeout and retry

### Improved
- ✅ **Refactored translator** - Split `convertMessages()` into smaller functions
- ✅ **Magic numbers removed** - All constants extracted and named
- ✅ **Error handling** - Better error messages and graceful degradation
- ✅ **Code organization** - Cleaner separation of concerns

### Performance
- ⚡ Async file operations (non-blocking)
- ⚡ Request timeout prevents resource leaks
- ⚡ Retry logic handles transient network failures
- ⚡ Rate limiter with automatic cleanup

### Security
- 🔒 Optional API key authentication
- 🔒 Request size limits
- 🔒 Rate limiting protection

## v1.0.0 - Initial Release

### Features
- AWS Builder ID OAuth device flow
- Automatic token refresh
- OpenAI-compatible API
- AWS EventStream binary parser
- Streaming support (SSE)
- Minimal dependencies (only uuid)
