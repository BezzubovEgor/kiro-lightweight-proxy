#!/usr/bin/env node
/**
 * AWS EventStream Parser - Parses binary AWS EventStream format
 * Used by Kiro/CodeWhisperer API responses
 */

// CRC32 lookup table (IEEE polynomial)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Parse single AWS EventStream frame
 */
function parseEventFrame(data) {
  try {
    const view = new DataView(data.buffer, data.byteOffset);
    const totalLength = view.getUint32(0, false);
    const headersLength = view.getUint32(4, false);

    // Validate prelude CRC
    const preludeCRC = view.getUint32(8, false);
    const computedPreludeCRC = crc32(data.slice(0, 8));
    if (preludeCRC !== computedPreludeCRC) {
      console.warn('[EventStream] Prelude CRC mismatch - skipping frame');
      return null;
    }

    // Validate message CRC
    const messageCRC = view.getUint32(data.length - 4, false);
    const computedMessageCRC = crc32(data.slice(0, data.length - 4));
    if (messageCRC !== computedMessageCRC) {
      console.warn('[EventStream] Message CRC mismatch - skipping frame');
      return null;
    }

    // Parse headers
    const headers = {};
    let offset = 12;
    const headerEnd = 12 + headersLength;

    while (offset < headerEnd && offset < data.length) {
      const nameLen = data[offset++];
      if (offset + nameLen > data.length) break;

      const name = new TextDecoder().decode(data.slice(offset, offset + nameLen));
      offset += nameLen;

      const headerType = data[offset++];

      if (headerType === 7) { // String type
        const valueLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        if (offset + valueLen > data.length) break;

        const value = new TextDecoder().decode(data.slice(offset, offset + valueLen));
        offset += valueLen;
        headers[name] = value;
      } else {
        break;
      }
    }

    // Parse payload
    const payloadStart = 12 + headersLength;
    const payloadEnd = data.length - 4;

    let payload = null;
    if (payloadEnd > payloadStart) {
      const payloadStr = new TextDecoder().decode(data.slice(payloadStart, payloadEnd));
      if (payloadStr && payloadStr.trim()) {
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          payload = { raw: payloadStr };
        }
      }
    }

    return { headers, payload };
  } catch (error) {
    console.warn('[EventStream] Frame parse error:', error.message);
    return null;
  }
}

/**
 * Parse AWS EventStream from buffer and convert to OpenAI SSE format
 */
export function parseEventStreamToOpenAI(buffer, model) {
  const chunks = [];
  const responseId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  let chunkIndex = 0;
  let hasToolCalls = false;
  let totalTokens = { input: 0, output: 0 };

  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 16) break;

    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    const totalLength = view.getUint32(0, false);

    if (totalLength < 16 || offset + totalLength > buffer.length) break;

    const eventData = buffer.slice(offset, offset + totalLength);
    offset += totalLength;

    const event = parseEventFrame(eventData);
    if (!event) continue;

    const eventType = event.headers[':event-type'] || '';

    // Handle assistantResponseEvent (text content)
    if (eventType === 'assistantResponseEvent') {
      const content = event.payload?.content || '';
      if (content) {
        chunks.push({
          id: responseId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: chunkIndex === 0 ? { role: 'assistant', content } : { content },
            finish_reason: null,
          }],
        });
        chunkIndex++;
      }
    }

    // Handle codeEvent
    if (eventType === 'codeEvent' && event.payload?.content) {
      chunks.push({
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: event.payload.content },
          finish_reason: null,
        }],
      });
      chunkIndex++;
    }

    // Handle toolUseEvent
    if (eventType === 'toolUseEvent' && event.payload) {
      hasToolCalls = true;
      const toolUse = event.payload;
      chunks.push({
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: 0,
              id: toolUse.toolUseId || `call_${Date.now()}`,
              type: 'function',
              function: {
                name: toolUse.name || '',
                arguments: JSON.stringify(toolUse.input || {}),
              },
            }],
          },
          finish_reason: null,
        }],
      });
      chunkIndex++;
    }

    // Handle metricsEvent (token usage)
    if (eventType === 'metricsEvent') {
      const metrics = event.payload?.metricsEvent || event.payload;
      if (metrics) {
        totalTokens.input = metrics.inputTokens || 0;
        totalTokens.output = metrics.outputTokens || 0;
      }
    }
  }

  // Add final chunk with finish_reason
  chunks.push({
    id: responseId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: hasToolCalls ? 'tool_calls' : 'stop',
    }],
    usage: {
      prompt_tokens: totalTokens.input,
      completion_tokens: totalTokens.output,
      total_tokens: totalTokens.input + totalTokens.output,
    },
  });

  return chunks;
}

/**
 * Convert chunks to SSE format
 */
export function chunksToSSE(chunks) {
  let sse = '';
  for (const chunk of chunks) {
    sse += `data: ${JSON.stringify(chunk)}\n\n`;
  }
  sse += 'data: [DONE]\n\n';
  return sse;
}
