#!/usr/bin/env node
/**
 * Request Translator - Convert OpenAI format to Kiro/AWS CodeWhisperer format
 */
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

const NAMESPACE_KIRO = '34f7193f-561d-4050-bc84-9547d953d6bf';

/**
 * Extract content from message
 */
function extractContent(msg) {
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter(c => c.type === 'text' || c.text)
      .map(c => c.text || '')
      .join('\n');
  }
  return '';
}

/**
 * Normalize role (system/tool -> user)
 */
function normalizeRole(role) {
  return (role === 'system' || role === 'tool') ? 'user' : role;
}

/**
 * Create tools specification for Kiro
 */
function createToolsSpec(tools) {
  if (!tools || tools.length === 0) return null;
  
  return tools.map(t => ({
    toolSpecification: {
      name: t.function?.name || t.name,
      description: t.function?.description || t.description || `Tool: ${t.function?.name || t.name}`,
      inputSchema: {
        json: t.function?.parameters || t.parameters || t.input_schema || {},
      },
    },
  }));
}

/**
 * Initialize conversion state
 */
function initializeState() {
  return {
    history: [],
    currentMessage: null,
    pendingUserContent: [],
    pendingAssistantContent: [],
    currentRole: null,
  };
}

/**
 * Flush pending messages to history
 */
function flushPending(state, tools) {
  if (state.currentRole === 'user') {
    const content = state.pendingUserContent.join('\n\n').trim() || 'continue';
    const userMsg = {
      userInputMessage: {
        content,
        modelId: '',
      },
    };

    // Add tools to first user message
    const toolsSpec = createToolsSpec(tools);
    if (toolsSpec && state.history.length === 0) {
      userMsg.userInputMessage.userInputMessageContext = { tools: toolsSpec };
    }

    state.history.push(userMsg);
    state.currentMessage = userMsg;
    state.pendingUserContent = [];
  } else if (state.currentRole === 'assistant') {
    const content = state.pendingAssistantContent.join('\n\n').trim() || '...';
    state.history.push({
      assistantResponseMessage: { content },
    });
    state.pendingAssistantContent = [];
  }
}

/**
 * Process a single message
 */
function processMessage(msg, state, tools) {
  const role = normalizeRole(msg.role);

  // If role changes, flush pending
  if (role !== state.currentRole && state.currentRole !== null) {
    flushPending(state, tools);
  }
  state.currentRole = role;

  if (role === 'user') {
    const content = extractContent(msg);
    if (content) state.pendingUserContent.push(content);
  } else if (role === 'assistant') {
    const content = extractContent(msg);
    if (content) state.pendingAssistantContent.push(content);
  }
}

/**
 * Finalize state and return result
 */
function finalizeState(state) {
  // If last message in history is userInputMessage, use it as currentMessage
  if (state.history.length > 0 && state.history[state.history.length - 1].userInputMessage) {
    state.currentMessage = state.history.pop();
  }

  return { history: state.history, currentMessage: state.currentMessage };
}

/**
 * Convert OpenAI messages to Kiro conversationState format
 */
function convertMessages(messages, tools) {
  const state = initializeState();

  for (const msg of messages) {
    processMessage(msg, state, tools);
  }

  // Flush remaining
  if (state.currentRole !== null) {
    flushPending(state, tools);
  }

  return finalizeState(state);
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
