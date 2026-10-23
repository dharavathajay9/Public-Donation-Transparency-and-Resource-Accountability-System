import { useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Icon,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  TableWrap,
  Td,
  TextInput,
  Th,
  useToast,
} from '../components/ui'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { date, titleCase } from '../lib/format'
import type { Role, User } from '../lib/types'

interface UserRow extends User {
  is_active: number
  created_at: string
}

const ROLES: Role[] = ['admin', 'staff', 'auditor', 'donor']

export default function Users() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi<{ users: UserRow[] }>('/users')
  const meta = useApi<{ organizations: Array<{ id: number; name: string }> }>('/meta')
  const [open, setOpen] = useState(false)
  const rows = data?.users ?? []

  const update = async (target: UserRow, changes: { role?: string; is_active?: boolean }) => {
    try {
      await api.patch(`/users/${target.id}`, changes)
      toast.push(`${target.name} updated`)
      reload()
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not update user.', 'error')
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Team access"
        description="Role-based access separates administrators, organization staff, auditors and donors."
        actions={
          <Button icon="plus" onClick={() => setOpen(true)}>
            Create account
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{titleCase(role)}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
              {rows.filter((row) => row.role === role).length}
            </p>
            <p className="text-[10px] text-ink-400">
              {role === 'admin'
                ? 'full control'
                : role === 'staff'
                  ? 'records for own organization'
                  : role === 'auditor'
                    ? 'read-only + audit trail'
                    : 'own giving history'}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock />
        ) : rows.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Role</Th>
                <Th>Organization</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-sand-50/60">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.name} size="sm" />
                      <div>
                        <p className="text-[13px] font-medium text-ink-900">{row.name}</p>
                        <p className="text-[10px] text-ink-400">{row.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {row.id === user?.id ? (
                      <Badge tone="brand">{titleCase(row.role)} (you)</Badge>
                    ) : (
                      <Select
                        value={row.role}
                        onChange={(event) => update(row, { role: event.target.value })}
                        className="h-8 min-w-[120px] py-0 text-xs"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {titleCase(role)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Td>
                  <Td className="text-[12px] text-ink-500">
                    {row.organization_name ?? (row.role === 'donor' ? 'Donor profile' : 'Platform-wide')}
                  </Td>
                  <Td>
                    <Badge tone={row.is_active ? 'brand' : 'red'}>
                      {row.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-ink-500">{date(row.created_at)}</Td>
                  <Td className="text-right">
                    {row.id === user?.id ? (
                      <span className="text-[10px] text-ink-300">—</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={row.is_active ? 'ghost' : 'secondary'}
                        onClick={() => update(row, { is_active: !row.is_active })}
                      >
                        {row.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState icon="userCog" title="No accounts yet" />
        )}
      </Card>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ['Administrator', 'Full access, user management, audit trail, all organizations.'],
          ['Staff', 'Records donations, campaigns, allocations and expenses for their own organization.'],
          ['Auditor', 'Read-only access to every record plus the audit trail.'],
          ['Donor', 'Sees only their own contributions and the public pages.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-sand-200 bg-white p-4">
            <p className="text-[11px] font-semibold text-ink-900">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{text}</p>
          </div>
        ))}
      </div>

      <CreateUserModal
        open={open}
        onClose={() => setOpen(false)}
        organizations={meta.data?.organizations ?? []}
        onSaved={(name) => {
          setOpen(false)
          toast.push(`Account created for ${name}`)
          reload()
        }}
      />
    </div>
  )
}

function CreateUserModal({
  open,
  onClose,
  organizations,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  organizations: Array<{ id: number; name: string }>
  onSaved: (name: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'staff',
    password: '',
    organization_id: organizations[0] ? String(organizations[0].id) : '',
  })

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      toast.push('Name, email and a password of at least 8 characters are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/users', {
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
        organization_id:
          form.role === 'staff' || form.organization_id ? Number(form.organization_id) : undefined,
      })
      onSaved(form.name)
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not create account.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create an account"
      description="Passwords are hashed with PBKDF2 before storage."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="userCog">
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Full name" required>
          <TextInput value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required>
            <TextInput type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={set('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {titleCase(role)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Organization"
          hint={form.role === 'staff' ? 'required for staff' : 'optional'}
        >
          <Select value={form.organization_id} onChange={set('organization_id')}>
            <option value="">No organization (platform-wide)</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Temporary password" required hint="minimum 8 characters">
          <TextInput
            type="text"
            value={form.password}
            onChange={set('password')}
            placeholder="Share securely with the user"
          />
        </Field>
        <div className="flex items-start gap-2 rounded-xl bg-sand-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-500">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The account is created in the same transaction as its audit entry. Disabling an account
          immediately invalidates its sessions.
        </div>
      </div>
    </Modal>
  )
}
