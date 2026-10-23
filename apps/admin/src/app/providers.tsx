import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ApiProvider } from '@/api/api-provider';
import type { ApiClient } from '@/api/client';
import { AuthProvider } from '@/auth/auth-context';
import type { SessionStore } from '@/auth/session';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });
}

export function AppProviders({
  client,
  session,
  queryClient,
  children,
}: {
  client: ApiClient;
  session: SessionStore;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [defaultQueryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      <ApiProvider client={client}>
        <AuthProvider session={session}>{children}</AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
