import { type ReactNode, createContext, useContext } from 'react';
import type { ApiClient } from './client';

const ApiContext = createContext<ApiClient | undefined>(undefined);

/** Makes the API client injectable, so tests can supply one backed by a stub `fetch`. */
export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>');
  return client;
}
