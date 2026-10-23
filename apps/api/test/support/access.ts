import type { Pool } from 'pg';

let counter = 0;

/** Gives the user a brand-new role holding exactly these permissions (optionally scoped to one drawer). */
export async function grantPermissions(
  pool: Pool,
  userId: string,
  permissions: string[],
  drawerId: string | null = null,
): Promise<string> {
  const role = await pool.query<{ id: string }>(
    'INSERT INTO roles (name) VALUES ($1) RETURNING id',
    [`Test role ${(counter += 1)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`],
  );
  const roleId = role.rows[0]!.id;
  for (const key of permissions) {
    await pool.query('INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)', [
      roleId,
      key,
    ]);
  }
  await pool.query('INSERT INTO user_roles (user_id, role_id, drawer_id) VALUES ($1, $2, $3)', [
    userId,
    roleId,
    drawerId,
  ]);
  return roleId;
}

export async function makeSuperAdmin(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE is_super_admin ON CONFLICT DO NOTHING`,
    [userId],
  );
}

/** Removes every role assignment of the user (deactivates their admin access). */
export async function removeAllRoles(pool: Pool, userId: string): Promise<void> {
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
}
