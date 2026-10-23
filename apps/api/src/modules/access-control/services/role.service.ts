import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { UniqueViolationError, pgErrorCode } from '../../../db/errors';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { withTransaction } from '../../../db/transaction';
import { type Actor, AuditLog } from '../../reporting-audit';
import { RoleRepository, type RoleWithPermissions } from '../data/role.repository';
import {
  roleInUse,
  roleLocked,
  roleNameTaken,
  roleNotFound,
  unknownPermissions,
} from '../domain/role-errors';
import { PermissionAuthority } from './permission-authority';

const NAME_KEY = 'roles_name_lower_key';
const FK_VIOLATION = '23503';
const INTEGRITY = '23000';

export interface RoleInput {
  name?: string | undefined;
  description?: string | null | undefined;
  permissions?: string[] | undefined;
}

const snapshot = (role: RoleWithPermissions) => ({
  name: role.name,
  description: role.description,
  permissions: role.permissions,
});

/**
 * Role CRUD (README §13.5). Every change is audited in the same transaction and invalidates the permission cache once
 * it has committed. Final anti-escalation rules (a granter may only grant what they hold) are P2-13; until then the
 * controller demands a Super Admin.
 */
@Injectable()
export class RoleService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly roles: RoleRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLog,
    private readonly authority: PermissionAuthority,
  ) {}

  list(): Promise<RoleWithPermissions[]> {
    return this.roles.list(this.db);
  }

  async get(id: string): Promise<RoleWithPermissions> {
    const role = await this.roles.find(this.db, id);
    if (!role) throw roleNotFound();
    return role;
  }

  async create(
    actor: Actor,
    input: {
      name: string;
      description?: string | null | undefined;
      permissions?: string[] | undefined;
    },
  ): Promise<RoleWithPermissions> {
    const keys = await this.checkedPermissions(input.permissions ?? []);
    try {
      const id = await withTransaction(this.db, async (trx) => {
        const role = await this.roles.insert(trx, {
          name: input.name,
          description: input.description ?? null,
        });
        await this.roles.replacePermissions(trx, role.id, keys);
        const created = await this.roles.find(trx, role.id);
        await this.audit.record(trx, {
          actor,
          action: 'role.created',
          entityType: 'role',
          entityId: role.id,
          after: created && snapshot(created),
        });
        return role.id;
      });
      return await this.get(id);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(actor: Actor, id: string, input: RoleInput): Promise<RoleWithPermissions> {
    const keys =
      input.permissions === undefined
        ? undefined
        : await this.checkedPermissions(input.permissions);
    try {
      await withTransaction(this.db, async (trx) => {
        const role = await this.roles.lock(trx, id);
        if (!role) throw roleNotFound();
        if (role.is_system) throw roleLocked();
        const before = await this.roles.find(trx, id);
        await this.roles.update(trx, id, {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
        });
        if (keys !== undefined) await this.roles.replacePermissions(trx, id, keys);
        const after = await this.roles.find(trx, id);
        await this.audit.record(trx, {
          actor,
          action: 'role.updated',
          entityType: 'role',
          entityId: id,
          before: before && snapshot(before),
          after: after && snapshot(after),
        });
      });
    } catch (error) {
      throw this.translate(error);
    }
    this.authority.invalidateAll(); // everybody holding this role is affected
    return this.get(id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    try {
      await withTransaction(this.db, async (trx) => {
        const role = await this.roles.lock(trx, id);
        if (!role) throw roleNotFound();
        if (role.is_system) throw roleLocked();
        if ((await this.roles.assignmentCount(trx, id)) > 0) throw roleInUse();
        if ((await this.roles.openInvitationCount(trx, id, this.clock.now())) > 0)
          throw roleInUse();
        const before = await this.roles.find(trx, id);
        await this.roles.remove(trx, id);
        await this.audit.record(trx, {
          actor,
          action: 'role.deleted',
          entityType: 'role',
          entityId: id,
          before: before && snapshot(before),
        });
      });
    } catch (error) {
      throw this.translate(error, true);
    }
    this.authority.invalidateAll();
  }

  /** Unknown keys are a client error; duplicates collapse; the result is sorted for stable output. */
  private async checkedPermissions(requested: readonly string[]): Promise<string[]> {
    const unique = [...new Set(requested)];
    const known = await this.roles.knownPermissionKeys(this.db, unique);
    const unknown = unique.filter((key) => !known.has(key));
    if (unknown.length > 0) throw unknownPermissions(unknown);
    return unique.sort();
  }

  /** Database backstops (races the checks above cannot see) become the same domain errors. */
  private translate(error: unknown, deleting = false): unknown {
    if (error instanceof UniqueViolationError && error.constraint === NAME_KEY) {
      return roleNameTaken();
    }
    const code = pgErrorCode(error);
    if (deleting && code === FK_VIOLATION) return roleInUse(); // a role was assigned between the check and the delete
    if (code === INTEGRITY) return roleLocked(); // the system-role trigger
    return error;
  }
}
