import { createClient } from '@vercel/flags-core';
import type { IncomingMessage, ServerResponse } from 'node:http';

const BIZEYE_RESOLVE_FLAG_KEY = 'bizeye-resolve';
const flagsClient = createClient();

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
};

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET');
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    const result = await flagsClient.evaluate<boolean>(BIZEYE_RESOLVE_FLAG_KEY, false);
    response.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=300');
    sendJson(response, 200, {
      flags: {
        [BIZEYE_RESOLVE_FLAG_KEY]: Boolean(result.value),
      },
      reason: result.reason,
    });
  } catch (error) {
    console.error('Failed to evaluate Vercel flag.', error);
    sendJson(response, 200, {
      flags: {
        [BIZEYE_RESOLVE_FLAG_KEY]: false,
      },
      reason: 'fallback',
    });
  }
}
