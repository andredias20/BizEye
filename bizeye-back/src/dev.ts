import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { WebSocketServer } from 'ws';

config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const { default: app } = await import('./server.js');

const port = Number(process.env.PORT ?? 3000);
const webSocketServer = new WebSocketServer({ noServer: true });

serve(
  {
    fetch: app.fetch,
    port,
    websocket: {
      server: webSocketServer,
    },
  },
  (info) => {
    console.log(`BizEye back listening on http://localhost:${info.port}`);
  },
);
