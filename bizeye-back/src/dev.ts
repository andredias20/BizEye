import { serve } from '@hono/node-server';
import { config } from 'dotenv';

config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const { default: app } = await import('./index.js');

const port = Number(process.env.PORT ?? 3000);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`BizEye back listening on http://localhost:${info.port}`);
  },
);
