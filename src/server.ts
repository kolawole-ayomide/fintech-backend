import { env } from '@config/env';
import { createApp } from './app';

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});