import { useQuery } from '@tanstack/react-query';
import { useApi } from './api-provider';

export type ApiStatus = 'ok' | 'down' | 'checking';

const REFRESH_MS = 30_000;

/** Liveness of the API as seen from the browser (`GET /healthz`), refreshed every 30 s. */
export function useApiHealth(): { status: ApiStatus } {
  const api = useApi();
  const query = useQuery({
    queryKey: ['api', 'health'],
    queryFn: async () => {
      const { data, response } = await api.GET('/healthz');
      if (!response.ok || !data) throw new Error('API unavailable');
      return data;
    },
    refetchInterval: REFRESH_MS,
  });

  if (query.isError) return { status: 'down' };
  if (query.isSuccess) return { status: 'ok' };
  return { status: 'checking' };
}
