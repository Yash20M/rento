import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createClientFromEnv } from '@/api/client';
import { AppProviders } from '@/app/providers';
import { createAppRouter } from '@/app/router';
import { SessionStore } from '@/auth/session';
import { EnvError, parseEnv } from '@/config/env';
import { setMediaBase } from '@/lib/media';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

try {
  const env = parseEnv(import.meta.env);
  setMediaBase(env.apiBaseUrl);
  const session = new SessionStore();
  root.render(
    <StrictMode>
      <AppProviders client={createClientFromEnv(env, session)} session={session}>
        <RouterProvider router={createAppRouter()} />
      </AppProviders>
    </StrictMode>,
  );
} catch (error) {
  // Fail fast with a readable message instead of a blank page.
  const message = error instanceof EnvError ? error.message : 'The application failed to start.';
  root.render(
    <main role="alert" style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Rento Admin cannot start</h1>
      <p>{message}</p>
    </main>,
  );
}
