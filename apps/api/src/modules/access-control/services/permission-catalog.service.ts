import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { PermissionRepository } from '../data/permission.repository';
import { type CatalogDiff, diffCatalog } from '../domain/permissions';

/** Code defines permissions the database does not know: no role could ever hold them. */
export class PermissionCatalogDriftError extends Error {
  constructor(readonly missingInDatabase: readonly string[]) {
    super(
      `Permission catalog drift: the permissions table lacks ${missingInDatabase.join(', ')}. ` +
        'Add a migration that inserts them (README §13.5).',
    );
    this.name = 'PermissionCatalogDriftError';
  }
}

/**
 * Keeps code and the `permissions` table honest (README §13.5).
 *  - Missing in the database ⇒ the process refuses to start.
 *  - Unknown to code ⇒ warning only: a rollback runs old code against a newer schema, and that must stay possible.
 *  - Database unreachable ⇒ warning; /readyz reports it and the check runs again at the next start.
 */
@Injectable()
export class PermissionCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionCatalogService.name);

  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly permissions: PermissionRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    let keys: string[];
    try {
      keys = await this.permissions.listKeys(this.db);
    } catch {
      this.logger.warn('permission catalog not checked: the database is not reachable yet');
      return;
    }
    const diff = this.verify(keys);
    if (diff.unknownToCode.length > 0) {
      this.logger.warn(
        `permissions table has keys this build does not know: ${diff.unknownToCode.join(', ')}`,
      );
    }
  }

  /** @throws PermissionCatalogDriftError when the table lacks a key the code defines. */
  verify(databaseKeys: Iterable<string>): CatalogDiff {
    const diff = diffCatalog(databaseKeys);
    if (diff.missingInDatabase.length > 0) {
      throw new PermissionCatalogDriftError(diff.missingInDatabase);
    }
    return diff;
  }
}
