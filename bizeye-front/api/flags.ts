import { createClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

const BIZEYE_RESOLVE_FLAG_KEY = 'bizeye-resolve';
const BIZEYE_CHAT_MERGE_FLAG_KEY = 'bizeye-chat-merge';
const BIZEYE_CHAT_TRANSPORT_FLAG_KEY = 'bizeye-chat-transport';
const flagsClient = createClient();

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
};

const normalizeChatTransport = (value: unknown) => {
  return value === 'websocket' ? 'websocket' : 'sse';
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET');
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const [resolveResult, chatMergeResult, chatTransportResult] = await Promise.all([
      flagsClient.evaluate<boolean>(BIZEYE_RESOLVE_FLAG_KEY, false),
      flagsClient.evaluate<boolean>(BIZEYE_CHAT_MERGE_FLAG_KEY, false),
      flagsClient.evaluate<string>(BIZEYE_CHAT_TRANSPORT_FLAG_KEY, 'sse'),
    ]);
    response.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=300');
    sendJson(response, 200, {
      flags: {
        [BIZEYE_CHAT_MERGE_FLAG_KEY]: Boolean(chatMergeResult.value),
        [BIZEYE_CHAT_TRANSPORT_FLAG_KEY]: normalizeChatTransport(chatTransportResult.value),
        [BIZEYE_RESOLVE_FLAG_KEY]: Boolean(resolveResult.value),
      },
      reason: {
        [BIZEYE_CHAT_MERGE_FLAG_KEY]: chatMergeResult.reason,
        [BIZEYE_CHAT_TRANSPORT_FLAG_KEY]: chatTransportResult.reason,
        [BIZEYE_RESOLVE_FLAG_KEY]: resolveResult.reason,
      },
    });
  } catch (error) {
    console.error('Failed to evaluate Vercel flag.', error);
    sendJson(response, 200, {
      flags: {
        [BIZEYE_CHAT_MERGE_FLAG_KEY]: false,
        [BIZEYE_CHAT_TRANSPORT_FLAG_KEY]: 'sse',
        [BIZEYE_RESOLVE_FLAG_KEY]: false,
      },
      reason: 'fallback',
    });
  }
}
