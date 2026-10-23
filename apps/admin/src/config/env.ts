import { z } from 'zod';

export interface Env {
  /** Origin of the API, no trailing slash. Empty string = same origin (dev proxy / reverse proxy). */
  apiBaseUrl: string;
}

/** Thrown for invalid environment. Names the key, never echoes the offending value. */
export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment: ${problems.join('; ')}`);
    this.name = 'EnvError';
  }
}

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const schema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .optional()
    .transform((value) => (value ?? '').trim().replace(/\/+$/, ''))
    .refine((value) => value === '' || isHttpUrl(value), {
      error: 'must be an http(s) URL or empty',
    }),
});

export function parseEnv(raw: Readonly<Record<string, unknown>>): Env {
  const result = schema.safeParse({ VITE_API_BASE_URL: raw['VITE_API_BASE_URL'] });
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${String(issue.path[0] ?? 'env')}: ${issue.message}`),
    );
  }
  return { apiBaseUrl: result.data.VITE_API_BASE_URL };
}
