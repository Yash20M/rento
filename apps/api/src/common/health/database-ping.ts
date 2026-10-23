export const DATABASE_PING = Symbol('DATABASE_PING');

export interface DatabasePing {
  /** Resolves if the database answers `select 1`; rejects otherwise. */
  ping(): Promise<void>;
}
