# Bug Fixes - v2.0.1

## Critical Fixes

### 1. Fixed 400 "Improperly formed request" Error

**Problem:**
```javascript
// History messages had empty modelId
{
  userInputMessage: {
    content: "...",
    modelId: ""  // ← Kiro API rejected this
  }
}
```

**Solution:**
```javascript
// Removed modelId from history messages
{
  userInputMessage: {
    content: "..."
    // modelId only in currentMessage, not history
  }
}
```

**Impact:** Proxy now works correctly with Kiro API

### 2. Fixed Token Cache Not Updating After Refresh

**Problem:**
```javascript
await saveToken(updatedToken);
// cachedToken was not updated
return updatedToken.accessToken;
```

**Solution:**
```javascript
await saveToken(updatedToken);
cachedToken = updatedToken;  // ← Update cache immediately
return updatedToken.accessToken;
```

**Impact:** Token refresh now properly updates in-memory cache

## Testing

Both fixes verified:
- ✅ Translation test passes (no modelId in history)
- ✅ Token manager test passes (cache updates correctly)
- ✅ All components ready

## Files Changed

- `src/translator.js` - Removed modelId from history messages
- `src/token-manager.js` - Update cachedToken after refresh

## Commit

```
4aace16 Fix critical bugs: remove modelId from history messages and ensure cache updates on refresh
```
