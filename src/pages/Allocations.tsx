import { useEffect, useState } from 'react'
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
  ProgressBar,
  Select,
  StatusBadge,
  TableWrap,
  Td,
  TextInput,
  Textarea,
  Th,
  useToast,
} from '../components/ui'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compactInr, date, inr, inputDate, number } from '../lib/format'
import type { Allocation, Meta } from '../lib/types'

interface AllocationList {
  allocations: Allocation[]
  total: number
  totals: { funds: number; pending: number }
  page: number
  per_page: number
}

export default function Allocations() {
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === 'admin' || user?.role === 'staff'
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [kind, setKind] = useState('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deliverFor, setDeliverFor] = useState<Allocation | null>(null)

  const params = new URLSearchParams({ page: String(page), per_page: '20' })
  if (status !== 'all') params.set('status', status)
  if (kind !== 'all') params.set('kind', kind)
  if (search.trim()) params.set('q', search.trim())

  const { data, loading, error, reload } = useApi<AllocationList>(`/allocations?${params.toString()}`)
  const meta = useApi<Meta>('/meta')
  const rows = data?.allocations ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Allocations & deliveries"
        description="Commit funds or goods to verified beneficiaries, then record each handover."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setCreateOpen(true)}>
              New allocation
            </Button>
          ) : (
            <Badge tone="gold">Read-only access</Badge>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Funds allocated', compactInr(data?.totals.funds ?? 0), 'share'],
          ['Awaiting delivery', number(data?.totals.pending ?? 0), 'clock'],
          ['Allocation records', number(data?.total ?? 0), 'layers'],
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
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 lg:flex-row lg:items-center">
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
              placeholder="Search reference, beneficiary or campaign"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-40">
              <Select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All types</option>
                <option value="fund">Funds</option>
                <option value="material">Materials</option>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All statuses</option>
                <option value="allocated">Allocated</option>
                <option value="partially_distributed">Partially delivered</option>
                <option value="distributed">Delivered</option>
              </Select>
            </div>
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
                  <Th>Reference</Th>
                  <Th>Beneficiary</Th>
                  <Th>Campaign</Th>
                  <Th className="text-right">Committed</Th>
                  <Th className="min-w-[150px]">Delivered</Th>
                  <Th>Status</Th>
                  {canWrite ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((allocation) => {
                  const target = allocation.kind === 'fund' ? allocation.amount : allocation.quantity
                  const delivered =
                    allocation.kind === 'fund' ? allocation.distributed_amount : allocation.distributed_quantity
                  return (
                    <tr key={allocation.id} className="transition hover:bg-sand-50/60">
                      <Td>
                        <p className="font-mono text-[11px] text-ink-700">{allocation.reference}</p>
                        <p className="text-[10px] text-ink-400">{date(allocation.allocated_at)}</p>
                      </Td>
                      <Td>
                        <p className="text-[13px] font-medium text-ink-900">{allocation.beneficiary_name}</p>
                        <p className="text-[10px] text-ink-400">{allocation.beneficiary_location}</p>
                      </Td>
                      <Td>
                        <p className="max-w-[220px] truncate text-[12px] text-ink-600">{allocation.campaign_title}</p>
                        <p className="font-mono text-[10px] text-ink-400">{allocation.campaign_code}</p>
                      </Td>
                      <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                        {allocation.kind === 'fund'
                          ? inr(allocation.amount)
                          : `${allocation.quantity} × ${allocation.item_name}`}
                        <span className="ml-1 block text-[10px] font-normal capitalize text-ink-400">
                          {allocation.kind === 'fund' ? 'funds' : 'materials'}
                        </span>
                      </Td>
                      <Td>
                        <ProgressBar value={delivered} max={target || 1} />
                        <p className="mt-1 text-[10px] text-ink-400">
                          {allocation.kind === 'fund'
                            ? `${compactInr(allocation.distributed_amount)} of ${compactInr(allocation.amount)}`
                            : `${allocation.distributed_quantity} of ${allocation.quantity} ${allocation.unit ?? ''}`}
                        </p>
                      </Td>
                      <Td>
                        <StatusBadge status={allocation.status} />
                      </Td>
                      {canWrite ? (
                        <Td className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={allocation.status === 'distributed'}
                            onClick={() => setDeliverFor(allocation)}
                          >
                            Deliver
                          </Button>
                        </Td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
            <Pagination page={data?.page ?? 1} perPage={data?.per_page ?? 20} total={data?.total ?? 0} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="share"
            title="No allocations recorded"
            description="Allocate campaign funds or donated goods to a beneficiary to begin the delivery trail."
            action={canWrite ? <Button icon="plus" onClick={() => setCreateOpen(true)}>New allocation</Button> : undefined}
          />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-[11px] text-ink-400">
        <Icon name="scale" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The database rejects any allocation beyond a campaign&apos;s received funds or donated items,
        and any delivery beyond the allocation balance.
      </p>

      {canWrite ? (
        <>
          <AllocationModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            campaigns={meta.data?.campaigns ?? []}
            beneficiaries={meta.data?.beneficiaries ?? []}
            onSaved={(reference) => {
              setCreateOpen(false)
              toast.push(`Allocation ${reference} created`)
              reload()
            }}
          />
          <DeliveryModal
            allocation={deliverFor}
            onClose={() => setDeliverFor(null)}
            onSaved={(amount, item) => {
              setDeliverFor(null)
              toast.push(`Delivery recorded · ${amount}${item ? ` × ${item}` : ''}`)
              reload()
            }}
          />
        </>
      ) : null}
    </div>
  )
}

function AllocationModal({
  open,
  onClose,
  campaigns,
  beneficiaries,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  campaigns: Meta['campaigns']
  beneficiaries: Meta['beneficiaries']
  onSaved: (reference: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    campaign_id: campaigns[0] ? String(campaigns[0].id) : '',
    beneficiary_id: '',
    kind: 'fund',
    amount: '',
    item_name: '',
    unit: 'unit',
    quantity: '',
    purpose: '',
    allocated_at: inputDate(),
  })

  const selectedCampaign = campaigns.find((campaign) => String(campaign.id) === form.campaign_id)
  const eligible = beneficiaries.filter(
    (beneficiary) => beneficiary.organization_id === selectedCampaign?.organization_id,
  )
  const unallocated = Math.max(0, (selectedCampaign?.raised ?? 0) - (selectedCampaign?.allocated ?? 0))

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    if (!form.beneficiary_id) {
      toast.push('Select a beneficiary for this allocation.', 'error')
      return
    }
    setSaving(true)
    try {
      const response = await api.post<{ allocation: Allocation }>('/allocations', {
        campaign_id: Number(form.campaign_id),
        beneficiary_id: Number(form.beneficiary_id),
        kind: form.kind,
        amount: form.kind === 'fund' ? Number(form.amount) : 0,
        item_name: form.kind === 'material' ? form.item_name : undefined,
        unit: form.kind === 'material' ? form.unit : undefined,
        quantity: form.kind === 'material' ? Number(form.quantity) : 0,
        purpose: form.purpose,
        allocated_at: form.allocated_at,
      })
      onSaved(response.allocation?.reference ?? 'created')
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not create allocation.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Commit an allocation"
      description="Only funds and goods actually received by the campaign can be allocated."
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="share">
            Create allocation
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Campaign" required hint={selectedCampaign ? `${inr(unallocated)} unallocated` : undefined}>
          <Select
            value={form.campaign_id}
            onChange={(event) =>
              setForm((current) => ({ ...current, campaign_id: event.target.value, beneficiary_id: '' }))
            }
          >
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.code} · {campaign.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Beneficiary" required hint={`${eligible.length} eligible`}>
          <Select value={form.beneficiary_id} onChange={set('beneficiary_id')}>
            <option value="">Select a beneficiary…</option>
            {eligible.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.id}>
                {beneficiary.name} · {beneficiary.location}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-1 rounded-xl bg-sand-100 p-1">
          {(
            [
              ['fund', 'Funds'],
              ['material', 'Materials'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((current) => ({ ...current, kind: value }))}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                form.kind === value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {form.kind === 'fund' ? (
          <Field label="Amount (₹)" required hint={`max ${inr(unallocated)}`}>
            <TextInput type="number" min="1" step="100" value={form.amount} onChange={set('amount')} />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Item" required className="sm:col-span-2">
              <TextInput value={form.item_name} onChange={set('item_name')} placeholder="Relief kits" />
            </Field>
            <Field label="Unit">
              <TextInput value={form.unit} onChange={set('unit')} />
            </Field>
            <Field label="Quantity" required className="sm:col-span-3">
              <TextInput type="number" min="0.1" step="1" value={form.quantity} onChange={set('quantity')} />
            </Field>
          </div>
        )}

        <Field label="Purpose" required>
          <TextInput
            value={form.purpose}
            onChange={set('purpose')}
            placeholder="Cash support for medical treatment and travel"
          />
        </Field>
        <Field label="Allocation date" required>
          <TextInput type="date" value={form.allocated_at} onChange={set('allocated_at')} />
        </Field>
        <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-brand-800">
          Allocations commit funds — they do not reduce the raised balance. Record each handover with
          a delivery entry so the beneficiary ledger reflects what was actually received.
        </p>
      </div>
    </Modal>
  )
}

function DeliveryModal({
  allocation,
  onClose,
  onSaved,
}: {
  allocation: Allocation | null
  onClose: () => void
  onSaved: (amount: string, item?: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const remaining = allocation
    ? allocation.kind === 'fund'
      ? Math.max(0, allocation.amount - allocation.distributed_amount)
      : Math.max(0, allocation.quantity - allocation.distributed_quantity)
    : 0
  const [form, setForm] = useState({ amount: '', evidence_ref: '', distributed_at: inputDate(), notes: '' })

  useEffect(() => {
    if (allocation) {
      setForm({ amount: '', evidence_ref: '', distributed_at: inputDate(), notes: '' })
    }
  }, [allocation?.id])

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  if (!allocation) return null

  const submit = async () => {
    setSaving(true)
    try {
      await api.post('/distributions', {
        allocation_id: allocation.id,
        amount: allocation.kind === 'fund' ? Number(form.amount || remaining) : 0,
        quantity: allocation.kind === 'material' ? Number(form.amount || remaining) : 0,
        evidence_ref: form.evidence_ref,
        distributed_at: form.distributed_at,
        notes: form.notes,
      })
      onSaved(
        allocation.kind === 'fund'
          ? inr(Number(form.amount || remaining))
          : `${Number(form.amount || remaining)} ${allocation.unit ?? 'unit'}`,
        allocation.kind === 'material' ? allocation.item_name ?? undefined : undefined,
      )
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not record delivery.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(allocation)}
      onClose={onClose}
      title="Record a delivery"
      description={`${allocation.reference} · ${allocation.beneficiary_name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="check">
            Record delivery
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-500">Committed</span>
            <span className="font-medium tabular-nums text-ink-900">
              {allocation.kind === 'fund'
                ? inr(allocation.amount)
                : `${allocation.quantity} × ${allocation.item_name}`}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-500">Already delivered</span>
            <span className="tabular-nums text-ink-700">
              {allocation.kind === 'fund'
                ? inr(allocation.distributed_amount)
                : `${allocation.distributed_quantity} ${allocation.unit ?? ''}`}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-sand-200 pt-1.5 text-xs">
            <span className="font-medium text-ink-700">Remaining</span>
            <span className="font-semibold tabular-nums text-brand-800">
              {allocation.kind === 'fund'
                ? inr(remaining)
                : `${remaining} ${allocation.unit ?? ''}`}
            </span>
          </div>
        </div>

        <Field
          label={allocation.kind === 'fund' ? 'Amount (₹)' : `Quantity (${allocation.unit ?? 'unit'})`}
          required
          hint={`max ${allocation.kind === 'fund' ? inr(remaining) : remaining}`}
        >
          <TextInput
            type="number"
            min="0.01"
            step="0.1"
            value={form.amount}
            onChange={set('amount')}
            placeholder={String(remaining)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Evidence reference" hint="handover / UTR">
            <TextInput value={form.evidence_ref} onChange={set('evidence_ref')} placeholder="GD-2481" />
          </Field>
          <Field label="Date" required>
            <TextInput type="date" value={form.distributed_at} onChange={set('distributed_at')} />
          </Field>
        </div>
        <Field label="Notes" hint="optional">
          <Textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="Bank transfer confirmed by beneficiary"
          />
        </Field>
      </div>
    </Modal>
  )
}
