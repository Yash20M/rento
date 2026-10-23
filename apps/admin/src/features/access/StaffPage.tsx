import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Admin } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDateTime, humanize } from '@/lib/format';
import { useDrawers } from '../drawers/DrawersPage';
import { useRoles } from './RolesPage';

interface Assignment {
  roleId: string;
  drawerId: string; // '' = all drawers
}

export function StaffPage() {
  const api = useApi();
  const { can, me } = useAuth();
  const manage = can('admins:manage');
  const admins = useQuery({
    queryKey: ['admins'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/admins')),
  });
  const invitations = useQuery({
    queryKey: ['invitations'],
    enabled: manage,
    queryFn: async () => unwrap(await api.GET('/v1/admin/admins/invitations')),
  });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Admin | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Admin | undefined>(undefined);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Staff"
        description="People who can sign in to this admin panel, and what they may do."
        actions={manage && <Button onClick={() => setInviting(true)}>Invite someone</Button>}
      />
      {admins.isPending && <Loading />}
      {admins.isError && <ErrorNote error={admins.error} onRetry={() => void admins.refetch()} />}
      {admins.isSuccess && admins.data.length === 0 && <EmptyState title="No staff yet" />}
      {admins.isSuccess && admins.data.length > 0 && (
        <Table aria-label="Staff">
          <THead>
            <Tr>
              <Th>Person</Th>
              <Th>Roles</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {admins.data.map((a) => (
              <Tr key={a.id}>
                <Td className="font-medium">
                  {a.displayName ?? a.email}
                  {a.displayName && (
                    <div className="text-xs font-normal text-muted-foreground">{a.email}</div>
                  )}
                </Td>
                <Td>
                  <ul className="grid gap-0.5 text-sm">
                    {a.roles.map((r) => (
                      <li key={`${r.roleId}-${r.drawerId ?? 'all'}`}>
                        {r.roleName}
                        {r.drawerId && (
                          <span className="text-muted-foreground"> · one drawer only</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td>
                  <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>
                    {humanize(a.status)}
                  </Badge>
                </Td>
                <Td>
                  {manage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                        Change roles
                      </Button>
                      {a.id !== me?.user.id && (
                        <Button variant="outline" size="sm" onClick={() => setDeactivating(a)}>
                          Remove access
                        </Button>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {manage && invitations.isSuccess && invitations.data.length > 0 && (
        <section aria-labelledby="pending-heading" className="grid gap-2">
          <h3 id="pending-heading" className="text-sm font-medium text-muted-foreground">
            Waiting to accept
          </h3>
          <PendingInvitations invitations={invitations.data} />
        </section>
      )}

      {inviting && <InviteForm onClose={() => setInviting(false)} />}
      {editing && <RolesForm admin={editing} onClose={() => setEditing(undefined)} />}
      {deactivating && (
        <Deactivate admin={deactivating} onClose={() => setDeactivating(undefined)} />
      )}
    </div>
  );
}

function PendingInvitations({
  invitations,
}: {
  invitations: Array<{
    id: string;
    email: string;
    expiresAt: string;
    roles: Array<{ roleName: string }>;
  }>;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE('/v1/admin/admins/invitations/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });
  return (
    <>
      <Table aria-label="Pending invitations">
        <THead>
          <Tr>
            <Th>Email</Th>
            <Th>Roles</Th>
            <Th>Link valid until</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {invitations.map((i) => (
            <Tr key={i.id}>
              <Td>{i.email}</Td>
              <Td className="text-sm">{i.roles.map((r) => r.roleName).join(', ')}</Td>
              <Td>{formatDateTime(i.expiresAt)}</Td>
              <Td className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(i.id)}
                >
                  Cancel invitation
                </Button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <ErrorNote error={revoke.error} />
    </>
  );
}

/** Rows of "role + which drawer" shared by the invite and change-roles forms. */
function AssignmentsEditor({
  rows,
  onChange,
  error,
}: {
  rows: Assignment[];
  onChange: (rows: Assignment[]) => void;
  error?: string | undefined;
}) {
  const roles = useRoles();
  const drawers = useDrawers();
  const set = (index: number, patch: Partial<Assignment>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Roles</legend>
      {roles.isError && <ErrorNote error={roles.error} />}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Role ${index + 1}`}
            className="w-56"
            value={row.roleId}
            onChange={(e) => set(index, { roleId: e.target.value })}
          >
            <option value="">Choose a role…</option>
            {(roles.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label={`Drawer ${index + 1}`}
            className="w-56"
            value={row.drawerId}
            onChange={(e) => set(index, { drawerId: e.target.value })}
          >
            <option value="">All drawers</option>
            {(drawers.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                Only {d.name}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove role ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { roleId: '', drawerId: '' }])}
        >
          Add a role
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

const toBody = (rows: Assignment[]) =>
  rows
    .filter((r) => r.roleId !== '')
    .map((r) => ({ roleId: r.roleId, drawerId: r.drawerId === '' ? null : r.drawerId }));

function InviteForm({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<Assignment[]>([{ roleId: '', drawerId: '' }]);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const invite = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/v1/admin/admins/invitations', {
          body: { email: email.trim(), roles: toBody(rows) },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setSent(true);
    },
  });
  const server = fieldErrors(invite.error);
  const problems = { ...server, ...local };

  function submit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors['email'] = 'Enter a valid email address.';
    if (toBody(rows).length === 0) errors['roles'] = 'Choose at least one role.';
    setLocal(errors);
    if (Object.keys(errors).length === 0) invite.mutate();
  }

  if (sent) {
    return (
      <Modal
        title="Invitation sent"
        onClose={onClose}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <p className="text-sm">
          We emailed {email.trim()} a link to choose a password. It works once and expires after a
          few days.
        </p>
      </Modal>
    );
  }
  return (
    <Modal
      title="Invite someone"
      description="They get an email with a link to create their account with the roles you choose."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            Send invitation
          </Button>
        </>
      }
    >
      <form id="invite-form" className="grid gap-4" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={problems['email']}
        />
        <AssignmentsEditor rows={rows} onChange={setRows} error={problems['roles']} />
        <ErrorNote
          error={invite.error && Object.keys(server).length === 0 ? invite.error : undefined}
        />
      </form>
    </Modal>
  );
}

function RolesForm({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Assignment[]>(
    admin.roles.map((r) => ({ roleId: r.roleId, drawerId: r.drawerId ?? '' })),
  );
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PUT('/v1/admin/admins/{userId}/roles', {
          params: { path: { userId: admin.id } },
          body: { roles: toBody(rows) },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admins'] });
      onClose();
    },
  });
  const problems = fieldErrors(save.error);
  return (
    <Modal
      title={`Roles of ${admin.displayName ?? admin.email ?? 'this person'}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save roles
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <AssignmentsEditor rows={rows} onChange={setRows} error={problems['roles']} />
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
      </div>
    </Modal>
  );
}

function Deactivate({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/admins/{userId}', { params: { path: { userId: admin.id } } }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admins'] });
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title="Remove admin access?"
      message={
        <>
          {admin.displayName ?? admin.email} will lose every role and can no longer use the admin
          panel. Their account and bookings stay. The last Super Admin can never be removed.
        </>
      }
      confirmLabel="Remove access"
      destructive
      busy={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    />
  );
}
