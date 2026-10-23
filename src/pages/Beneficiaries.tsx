import { useState } from 'react'
import {
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
  Pagination,
  Select,
  TableWrap,
  Td,
  TextInput,
  Th,
  useToast,
} from '../components/ui'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BENEFICIARY_CATEGORIES } from '../lib/constants'
import { compactInr, date, inr, number, titleCase } from '../lib/format'
import type { Beneficiary, Meta } from '../lib/types'

interface BeneficiaryList {
  beneficiaries: Beneficiary[]
  total: number
  page: number
  per_page: number
}

export default function Beneficiaries() {
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === 'admin' || user?.role === 'staff'
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [open, setOpen] = useState(false)

  const params = new URLSearchParams({ page: String(page), per_page: '20' })
  if (search.trim()) params.set('q', search.trim())
  if (category !== 'all') params.set('category', category)
  const { data, loading, error, reload } = useApi<BeneficiaryList>(`/beneficiaries?${params.toString()}`)
  const meta = useApi<Meta>('/meta')
  const rows = data?.beneficiaries ?? []

  const people = rows.reduce((sum, row) => sum + row.household_size, 0)
  const received = rows.reduce((sum, row) => sum + row.funds_received, 0)

  return (
    <div className="animate-rise">
      <PageHeader
        title="Beneficiaries"
        description="Verified people, families and institutions receiving support — with the full value delivered to each."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setOpen(true)}>
              Register beneficiary
            </Button>
          ) : (
            <Badge tone="gold">Read-only access</Badge>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Beneficiaries', number(rows.length), 'users'],
          ['People reached', number(people), 'heart'],
          ['Funds received', compactInr(received), 'banknote'],
        ].map(([label, value, icon]) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-ink-900">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
            />
            <TextInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search by name or location"
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All types</option>
              {BENEFICIARY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock />
        ) : rows.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Beneficiary</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Household</Th>
                  <Th className="text-right">Allocations</Th>
                  <Th className="text-right">Funds received</Th>
                  <Th className="text-right">Deliveries</Th>
                  {user?.role === 'admin' ? <Th>Organization</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-sand-50/60">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-[10px] font-semibold text-ink-500">
                          {row.name
                            .split(' ')
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-ink-900">{row.name}</p>
                          <p className="text-[10px] text-ink-400">{row.location}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="slate">{titleCase(row.category)}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-ink-500">{row.household_size}</Td>
                    <Td className="text-right tabular-nums text-ink-500">{row.allocation_count}</Td>
                    <Td className="text-right font-medium tabular-nums">
                      {inr(row.funds_received)}
                      <span className="ml-1 block text-[10px] font-normal text-ink-400">
                        allocated {compactInr(row.funds_allocated)}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums text-ink-500">{row.distributions_received}</Td>
                    {user?.role === 'admin' ? (
                      <Td className="text-[12px] text-ink-500">{row.organization_name}</Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={data?.page ?? 1} perPage={data?.per_page ?? 20} total={data?.total ?? 0} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="users"
            title="No beneficiaries registered"
            description="Register the people, schools or shelters your organization supports."
            action={canWrite ? <Button icon="plus" onClick={() => setOpen(true)}>Register beneficiary</Button> : undefined}
          />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-[11px] text-ink-400">
        <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Beneficiary details are not public. The public ledger shows support delivered at aggregate
        level only, protecting individual privacy.
      </p>

      {canWrite ? (
        <BeneficiaryModal
          open={open}
          onClose={() => setOpen(false)}
          organizations={meta.data?.organizations ?? []}
          isAdmin={user?.role === 'admin'}
          onSaved={(name) => {
            setOpen(false)
            toast.push(`${name} registered as a beneficiary`)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function BeneficiaryModal({
  open,
  onClose,
  organizations,
  isAdmin,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  organizations: Meta['organizations']
  isAdmin: boolean
  onSaved: (name: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    organization_id: organizations[0] ? String(organizations[0].id) : '',
    name: '',
    category: 'family',
    location: '',
    household_size: '1',
    contact: '',
  })
  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    if (!form.name.trim() || !form.location.trim()) {
      toast.push('Name and location are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/beneficiaries', {
        organization_id: isAdmin ? Number(form.organization_id) : undefined,
        name: form.name,
        category: form.category,
        location: form.location,
        household_size: Number(form.household_size),
        contact: form.contact,
      })
      onSaved(form.name)
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not register beneficiary.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register a beneficiary"
      description="Registered date and verification are recorded automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="users">
            Register
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {isAdmin ? (
          <Field label="Organization" required>
            <Select value={form.organization_id} onChange={set('organization_id')}>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Name" required>
          <TextInput value={form.name} onChange={set('name')} placeholder="Person, family, school or shelter" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Beneficiary type" required>
            <Select value={form.category} onChange={set('category')}>
              {BENEFICIARY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Household size">
            <TextInput type="number" min="1" value={form.household_size} onChange={set('household_size')} />
          </Field>
        </div>
        <Field label="Location" required>
          <TextInput value={form.location} onChange={set('location')} placeholder="Village / district, state" />
        </Field>
        <Field label="Contact" hint="optional, kept internal">
          <TextInput value={form.contact} onChange={set('contact')} placeholder="+91 …" />
        </Field>
        <p className="rounded-xl bg-sand-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-500">
          Registered on {date(new Date().toISOString())}. Beneficiary records are verified by default
          and can receive allocations from campaigns of the same organization.
        </p>
      </div>
    </Modal>
  )
}
