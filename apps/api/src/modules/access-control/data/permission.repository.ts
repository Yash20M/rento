import { Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';

@Injectable()
export class PermissionRepository {
  /** Every key currently in the catalog table. */
  async listKeys(db: Kysely<Database>): Promise<string[]> {
    const rows = await db.selectFrom('permissions').select('key').orderBy('key').execute();
    return rows.map((row) => row.key);
  }
}
