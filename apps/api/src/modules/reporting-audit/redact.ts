const SECRET_KEY = /pass(word)?|token|secret|hash|authorization|cookie|api[_-]?key|credential|otp/i;
const MAX_DEPTH = 8;

/**
 * Deep copy for the audit trail in which every value under a secret-looking key is replaced. An audit row must be
 * able to say that a password changed without ever containing it.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : redact(child, depth + 1),
      ]),
    );
  }
  return value;
}
