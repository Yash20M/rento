import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('C-01 defaults to same-origin (empty base URL)', () => {
    expect(parseEnv({})).toEqual({ apiBaseUrl: '' });
    expect(parseEnv({ VITE_API_BASE_URL: '' })).toEqual({ apiBaseUrl: '' });
  });

  it('C-02 accepts an http(s) URL and trims trailing slashes', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'https://api.example.com/' }).apiBaseUrl).toBe(
      'https://api.example.com',
    );
    expect(parseEnv({ VITE_API_BASE_URL: ' http://127.0.0.1:3000// ' }).apiBaseUrl).toBe(
      'http://127.0.0.1:3000',
    );
  });

  it.each(['ftp://example.com', 'not a url', 'javascript:alert(1)'])(
    'C-03 rejects %s, naming the key but not the value',
    (value) => {
      let error: unknown;
      try {
        parseEnv({ VITE_API_BASE_URL: value });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(EnvError);
      expect((error as Error).message).toContain('VITE_API_BASE_URL');
      expect((error as Error).message).not.toContain(value);
    },
  );
});
