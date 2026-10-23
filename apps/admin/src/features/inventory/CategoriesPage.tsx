import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import type { Category } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { ConfirmDialog, EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Field, Select, TextField } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modal';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';

export function useCategories() {
  const api = useApi();
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/categories')),
  });
}

export function CategoriesPage() {
  const { can } = useAuth();
  const writable = can('inventory:write');
  const categories = useCategories();
  const [editing, setEditing] = useState<Category | 'new' | undefined>(undefined);
  const [deleting, setDeleting] = useState<Category | undefined>(undefined);
  const names = new Map((categories.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Categories"
        description="Groups of things people can rent, such as game consoles or cameras."
        actions={writable && <Button onClick={() => setEditing('new')}>New category</Button>}
      />
      {categories.isPending && <Loading />}
      {categories.isError && (
        <ErrorNote error={categories.error} onRetry={() => void categories.refetch()} />
      )}
      {categories.isSuccess && categories.data.length === 0 && (
        <EmptyState
          title="No categories yet"
          hint="Create the first one to start adding item models."
        />
      )}
      {categories.isSuccess && categories.data.length > 0 && (
        <Table aria-label="Categories">
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Web name</Th>
              <Th>Inside</Th>
              <Th className="text-right">Item models</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {categories.data.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="text-muted-foreground">{c.slug}</Td>
                <Td>{c.parentId ? (names.get(c.parentId) ?? '—') : '—'}</Td>
                <Td className="text-right tabular-nums">{c.itemModelCount}</Td>
                <Td className="text-right">
                  {writable && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(c)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {editing && (
        <CategoryForm
          category={editing === 'new' ? undefined : editing}
          all={categories.data ?? []}
          onClose={() => setEditing(undefined)}
        />
      )}
      {deleting && <DeleteCategory category={deleting} onClose={() => setDeleting(undefined)} />}
    </div>
  );
}

function CategoryForm({
  category,
  all,
  onClose,
}: {
  category: Category | undefined;
  all: Category[];
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), parentId: parentId === '' ? null : parentId };
      return category
        ? unwrap(
            await api.PATCH('/v1/admin/categories/{id}', {
              params: { path: { id: category.id } },
              body: { ...body, ...(slug.trim() !== '' && { slug: slug.trim() }) },
            }),
          )
        : unwrap(
            await api.POST('/v1/admin/categories', {
              body: { ...body, ...(slug.trim() !== '' && { slug: slug.trim() }) },
            }),
          );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
  });
  const problems = fieldErrors(save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() !== '') save.mutate();
  }

  return (
    <Modal
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="category-form"
            disabled={save.isPending || name.trim() === ''}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" className="grid gap-4" onSubmit={submit} noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={problems['name']}
          maxLength={100}
          required
        />
        <TextField
          label="Web name (optional)"
          hint="Lower case letters, digits and dashes. Made from the name when empty."
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={problems['slug']}
        />
        <Field label="Inside category" error={problems['parentId']}>
          {(aria) => (
            <Select {...aria} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">None (top level)</option>
              {all
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
      </form>
    </Modal>
  );
}

function DeleteCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.DELETE('/v1/admin/categories/{id}', { params: { path: { id: category.id } } }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
  });
  return (
    <ConfirmDialog
      title="Delete category?"
      message={
        <>
          “{category.name}” will be removed. A category that still has item models or sub-categories
          cannot be deleted.
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
