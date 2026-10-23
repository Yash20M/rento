import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Role } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Textarea, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';

export function useRoles() {
  const api = useApi();
  const { can } = useAuth();
  return useQuery({
    queryKey: ['roles'],
    enabled: can('roles:read'),
    queryFn: async () => unwrap(await api.GET('/v1/admin/roles')),
  });
}

export function RolesPage() {
  const { can } = useAuth();
  const manage = can('roles:manage');
  const roles = useRoles();
  const [editing, setEditing] = useState<Role | 'new' | undefined>(undefined);
  const [deleting, setDeleting] = useState<Role | undefined>(undefined);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Roles"
        description="A role is a named set of permissions. Give people roles in the Staff section."
        actions={manage && <Button onClick={() => setEditing('new')}>New role</Button>}
      />
      {roles.isPending && <Loading />}
      {roles.isError && <ErrorNote error={roles.error} onRetry={() => void roles.refetch()} />}
      {roles.isSuccess && roles.data.length === 0 && <EmptyState title="No roles yet" />}
      {roles.isSuccess && roles.data.length > 0 && (
        <Table aria-label="Roles">
          <THead>
            <Tr>
              <Th>Role</Th>
              <Th>Description</Th>
              <Th className="text-right">Permissions</Th>
              <Th className="text-right">People</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {roles.data.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">
                  {r.name}{' '}
                  {r.isSuperAdmin && (
                    <Badge tone="info">
                      <Lock className="mr-1 size-3" aria-hidden="true" />
                      Locked
                    </Badge>
                  )}
                </Td>
                <Td className="text-muted-foreground">{r.description ?? '—'}</Td>
                <Td className="text-right tabular-nums">
                  {r.isSuperAdmin ? 'All' : r.permissions.length}
                </Td>
                <Td className="text-right tabular-nums">{r.assignedCount}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                      {manage && !r.isSuperAdmin ? 'Edit' : 'View'}
                    </Button>
                    {manage && !r.isSuperAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && (
        <RoleForm
          role={editing === 'new' ? undefined : editing}
          readOnly={editing !== 'new' && (!manage || editing.isSuperAdmin)}
          onClose={() => setEditing(undefined)}
        />
      )}
      {deleting && <DeleteRole role={deleting} onClose={() => setDeleting(undefined)} />}
    </div>
  );
}

function RoleForm({
  role,
  readOnly,
  onClose,
}: {
  role: Role | undefined;
  readOnly: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const groups = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/permissions')),
  });
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(role?.permissions ?? []));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        permissions: [...selected].sort(),
      };
      return role
        ? unwrap(
            await api.PATCH('/v1/admin/roles/{id}', { params: { path: { id: role.id } }, body }),
          )
        : unwrap(await api.POST('/v1/admin/roles', { body }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });
  const problems = fieldErrors(save.error);

  const toggle = (key: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() !== '') save.mutate();
  }

  return (
    <Modal
      title={role ? (readOnly ? role.name : `Edit ${role.name}`) : 'New role'}
      description={
        role?.isSuperAdmin
          ? 'The Super Admin role always holds every permission and cannot be changed or removed.'
          : undefined
      }
      onClose={onClose}
      wide
      footer={
        readOnly ? (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" disabled={save.isPending || name.trim() === ''}>
              Save
            </Button>
          </>
        )
      }
    >
      <form id="role-form" className="grid gap-4" onSubmit={submit} noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={problems['name']}
          disabled={readOnly}
          maxLength={60}
        />
        <Field label="Description" error={problems['description']}>
          {(aria) => (
            <Textarea
              {...aria}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              maxLength={300}
            />
          )}
        </Field>
        <fieldset className="grid gap-4" disabled={readOnly || role?.isSuperAdmin}>
          <legend className="mb-1 text-sm font-medium">Permissions</legend>
          {groups.isPending && <Loading />}
          {groups.isError && <ErrorNote error={groups.error} />}
          {(groups.data ?? []).map((group) => (
            <div key={group.group} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">{group.group}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((p) => (
                  <div key={p.key}>
                    <Checkbox
                      label={p.description}
                      checked={role?.isSuperAdmin ? true : selected.has(p.key)}
                      onChange={(e) => toggle(p.key, e.target.checked)}
                    />
                    <span className="ml-6 text-xs text-muted-foreground">{p.key}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {problems['permissions'] && (
            <p role="alert" className="text-xs text-destructive">
              {problems['permissions']}
            </p>
          )}
        </fieldset>
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

function DeleteRole({ role, onClose }: { role: Role; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(await api.DELETE('/v1/admin/roles/{id}', { params: { path: { id: role.id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title="Delete role?"
      message={
        <>
          “{role.name}” will be removed. A role that is still given to someone cannot be deleted —
          take it away from them first.
        </>
      }
      confirmLabel="Delete"
      destructive
      busy={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    />
  );
}
