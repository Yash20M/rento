import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { AdminRepository, type Assignment } from '../data/admin.repository';
import { invalidAssignments } from '../domain/admin-errors';

export interface RequestedAssignment {
  roleId: string;
  drawerId?: string | null | undefined;
}

/** Validates and normalises requested (role, drawer scope) pairs: known ids, no duplicates. */
@Injectable()
export class AssignmentChecker {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly admins: AdminRepository,
  ) {}

  async check(requested: readonly RequestedAssignment[]): Promise<Assignment[]> {
    const unique = new Map<string, Assignment>();
    for (const item of requested) {
      const drawerId = item.drawerId ?? null;
      unique.set(`${item.roleId}|${drawerId ?? ''}`, { roleId: item.roleId, drawerId });
    }
    const assignments = [...unique.values()];

    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const knownRoles = await this.admins.existingRoleIds(this.db, roleIds);
    const missingRole = roleIds.find((id) => !knownRoles.has(id));
    if (missingRole !== undefined) throw invalidAssignments(`unknown role: ${missingRole}`);

    const drawerIds = [...new Set(assignments.flatMap((a) => (a.drawerId ? [a.drawerId] : [])))];
    const knownDrawers = await this.admins.existingDrawerIds(this.db, drawerIds);
    const missingDrawer = drawerIds.find((id) => !knownDrawers.has(id));
    if (missingDrawer !== undefined) throw invalidAssignments(`unknown drawer: ${missingDrawer}`);
    return assignments;
  }
}
