#!/usr/bin/env node
/**
 * Request Translator - Convert OpenAI format to Kiro/AWS CodeWhisperer format
 */
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

const NAMESPACE_KIRO = '34f7193f-561d-4050-bc84-9547d953d6bf';

/**
 * Convert OpenAI messages to Kiro conversationState format
 */
function convertMessages(messages, tools) {
  const history = [];
  let currentMessage = null;
  let pendingUserContent = [];
  let pendingAssistantContent = [];
  let currentRole = null;

  const flushPending = () => {
    if (currentRole === 'user') {
      const content = pendingUserContent.join('\n\n').trim() || 'continue';
      const userMsg = {
        userInputMessage: {
          content,
          modelId: '',
        },
      };

      // Add tools to first user message
      if (tools && tools.length > 0 && history.length === 0) {
        userMsg.userInputMessage.userInputMessageContext = {
          tools: tools.map(t => ({
            toolSpecification: {
              name: t.function?.name || t.name,
              description: t.function?.description || t.description || `Tool: ${t.function?.name || t.name}`,
              inputSchema: {
                json: t.function?.parameters || t.parameters || t.input_schema || {},
              },
            },
          })),
        };
      }

      history.push(userMsg);
      currentMessage = userMsg;
      pendingUserContent = [];
    } else if (currentRole === 'assistant') {
      const content = pendingAssistantContent.join('\n\n').trim() || '...';
      history.push({
        assistantResponseMessage: {
          content,
        },
      });
      pendingAssistantContent = [];
    }
  };

  for (const msg of messages) {
    let role = msg.role;

    // Normalize: system/tool -> user
    if (role === 'system' || role === 'tool') {
      role = 'user';
    }

    // If role changes, flush pending
    if (role !== currentRole && currentRole !== null) {
      flushPending();
    }
    currentRole = role;

    if (role === 'user') {
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter(c => c.type === 'text' || c.text)
          .map(c => c.text || '')
          .join('\n');
      }

      if (content) {
        pendingUserContent.push(content);
      }
    } else if (role === 'assistant') {
      let textContent = '';
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = msg.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')
          .trim();
      }

      if (textContent) {
        pendingAssistantContent.push(textContent);
      }
    }
  }

  // Flush remaining
  if (currentRole !== null) {
    flushPending();
  }

  // If last message in history is userInputMessage, use it as currentMessage
  if (history.length > 0 && history[history.length - 1].userInputMessage) {
    currentMessage = history.pop();
  }

  return { history, currentMessage };
}

/**
 * Build Kiro API payload from OpenAI request
 */
export function buildKiroPayload(openaiRequest, model = 'claude-sonnet-4.5') {
  const messages = openaiRequest.messages || [];
  const tools = openaiRequest.tools || [];
  const maxTokens = openaiRequest.max_tokens || 4096;
  const temperature = openaiRequest.temperature;
  const topP = openaiRequest.top_p;

  const { history, currentMessage } = convertMessages(messages, tools);

  // Add timestamp context
  let finalContent = currentMessage?.userInputMessage?.content || '';
  const timestamp = new Date().toISOString();
  finalContent = `[Context: Current time is ${timestamp}]\n\n${finalContent}`;

  const payload = {
    conversationState: {
      chatTriggerType: 'MANUAL',
      conversationId: uuidv4(), // Will be overridden with deterministic ID
      currentMessage: {
        userInputMessage: {
          content: finalContent,
          modelId: model,
          origin: 'AI_EDITOR',
          ...(currentMessage?.userInputMessage?.userInputMessageContext && {
            userInputMessageContext: currentMessage.userInputMessage.userInputMessageContext,
          }),
        },
      },
      history,
    },
  };

  // Deterministic session caching - use first message content for cache key
  const firstContent = history.length > 0 && history[0].userInputMessage?.content
    ? history[0].userInputMessage.content
    : finalContent;

  payload.conversationState.conversationId = uuidv5(
    firstContent.substring(0, 4000),
    NAMESPACE_KIRO
  );

  // Add inference config
  if (maxTokens || temperature !== undefined || topP !== undefined) {
    payload.inferenceConfig = {};
    if (maxTokens) payload.inferenceConfig.maxTokens = maxTokens;
    if (temperature !== undefined) payload.inferenceConfig.temperature = temperature;
    if (topP !== undefined) payload.inferenceConfig.topP = topP;
  }

  return payload;
}
