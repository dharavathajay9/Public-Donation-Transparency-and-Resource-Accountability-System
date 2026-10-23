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
  Textarea,
  Th,
  useToast,
} from '../components/ui'
import { ApiError, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compactInr, date, inr, inputDate, number } from '../lib/format'
import type { Donation, Meta } from '../lib/types'

interface DonationList {
  donations: Donation[]
  total: number
  totals: { monetary: number; material: number }
  page: number
  per_page: number
}

const CHANNELS = [
  ['online', 'Online payment'],
  ['upi', 'UPI'],
  ['bank_transfer', 'Bank transfer'],
  ['cheque', 'Cheque'],
  ['cash', 'Cash'],
]

export default function Donations() {
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === 'admin' || user?.role === 'staff'
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [campaignId, setCampaignId] = useState('all')
  const [open, setOpen] = useState(false)

  const meta = useApi<Meta>('/meta')
  const params = new URLSearchParams({ page: String(page), per_page: '20' })
  if (search.trim()) params.set('q', search.trim())
  if (kind !== 'all') params.set('kind', kind)
  if (campaignId !== 'all') params.set('campaign_id', campaignId)
  const query = `/donations?${params.toString()}`
  const { data, loading, error, reload } = useApi<DonationList>(query)

  const campaigns = meta.data?.campaigns ?? []
  const donations = data?.donations ?? []

  return (
    <div className="animate-rise">
      <PageHeader
        title="Donation ledger"
        description="Every contribution — monetary or in-kind — recorded against a campaign with a permanent receipt."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setOpen(true)}>
              Record donation
            </Button>
          ) : (
            <Badge tone="gold">Read-only access</Badge>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['Contributions in view', number(data?.total ?? 0), 'heart'],
          ['Monetary value', compactInr(data?.totals.monetary ?? 0), 'banknote'],
          ['In-kind value', compactInr(data?.totals.material ?? 0), 'box'],
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
        <div className="flex flex-col gap-3 border-b border-sand-200 p-4 sm:flex-row sm:items-center">
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
              placeholder="Search receipt, donor or campaign"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-36">
              <Select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value)
                  setPage(1)
                }}
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                <option value="monetary">Monetary</option>
                <option value="material">In-kind</option>
              </Select>
            </div>
            <div className="w-52">
              <Select
                value={campaignId}
                onChange={(event) => {
                  setCampaignId(event.target.value)
                  setPage(1)
                }}
                aria-label="Filter by campaign"
              >
                <option value="all">All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.code} · {campaign.title.slice(0, 28)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock label="Loading donations…" />
        ) : donations.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Donation</Th>
                  <Th>Donor</Th>
                  <Th>Campaign</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Value</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.receipt_no} className="transition hover:bg-sand-50/60">
                    <Td>
                      <p className="font-mono text-[11px] text-ink-700">{donation.receipt_no}</p>
                      <p className="mt-0.5 text-[10px] capitalize text-ink-400">
                        {donation.channel.replace(/_/g, ' ')}
                      </p>
                    </Td>
                    <Td>
                      <p className="font-medium text-ink-900">{donation.donor_name}</p>
                      <p className="text-[10px] capitalize text-ink-400">{donation.donor_type}</p>
                    </Td>
                    <Td>
                      <p className="max-w-[240px] truncate text-[12.5px] text-ink-700">
                        {donation.campaign_title}
                      </p>
                      <p className="font-mono text-[10px] text-ink-400">{donation.campaign_code}</p>
                    </Td>
                    <Td>
                      <Badge tone={donation.kind === 'monetary' ? 'brand' : 'blue'}>
                        {donation.kind === 'monetary' ? 'Monetary' : 'In-kind'}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                      {donation.kind === 'monetary' ? (
                        inr(donation.amount)
                      ) : (
                        <span>
                          {donation.quantity} × {donation.item_name}
                          <span className="ml-1 block text-[10px] font-normal text-ink-400">
                            ≈ {inr(donation.estimated_value)}
                          </span>
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-500">{date(donation.donated_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination
              page={data?.page ?? 1}
              perPage={data?.per_page ?? 20}
              total={data?.total ?? 0}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon="heart"
            title="No donations found"
            description={
              canWrite
                ? 'Record the first contribution for your campaigns to start building the ledger.'
                : 'Nothing matches the current filters.'
            }
            action={
              canWrite ? (
                <Button icon="plus" onClick={() => setOpen(true)}>
                  Record donation
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 text-[11px] text-ink-400">
        <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Donations are immutable ledger records. Financial fields cannot be edited or deleted after
        saving; a correction is recorded as a new, audited entry.
      </div>

      {canWrite ? (
        <DonationModal
          open={open}
          onClose={() => setOpen(false)}
          campaigns={campaigns.filter((campaign) => campaign.status === 'active')}
          donors={meta.data?.donors ?? []}
          onSaved={(receipt) => {
            setOpen(false)
            toast.push(`Donation recorded · receipt ${receipt}`)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ modal */

function DonationModal({
  open,
  onClose,
  campaigns,
  donors,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  campaigns: Meta['campaigns']
  donors: Meta['donors']
  onSaved: (receipt: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'existing' | 'new'>(donors.length ? 'existing' : 'new')
  const [form, setForm] = useState({
    donor_id: donors[0] ? String(donors[0].id) : '',
    donor_name: '',
    donor_email: '',
    donor_type: 'individual',
    campaign_id: campaigns[0] ? String(campaigns[0].id) : '',
    kind: 'monetary',
    amount: '',
    item_name: '',
    unit: 'unit',
    quantity: '',
    estimated_value: '',
    channel: 'online',
    donated_at: inputDate(),
    notes: '',
  })

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        campaign_id: Number(form.campaign_id),
        kind: form.kind,
        donated_at: form.donated_at,
        notes: form.notes,
      }
      if (mode === 'existing') payload.donor_id = Number(form.donor_id)
      else {
        payload.donor_name = form.donor_name
        payload.donor_email = form.donor_email
        payload.donor_type = form.donor_type
      }
      if (form.kind === 'monetary') {
        payload.amount = Number(form.amount)
        payload.channel = form.channel
      } else {
        payload.item_name = form.item_name
        payload.unit = form.unit
        payload.quantity = Number(form.quantity)
        payload.estimated_value = Number(form.estimated_value || 0)
      }
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as { donation?: Donation; error?: { message: string } }
      if (!response.ok) throw new ApiError(body.error?.message ?? 'Could not record donation.', response.status, 'ERROR')
      onSaved(body.donation?.receipt_no ?? '')
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not record donation.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a donation"
      description="The donation is written with an audit entry in the same transaction."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="heart">
            Save donation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-xl bg-sand-100 p-1">
          {(
            [
              ['existing', 'Existing donor'],
              ['new', 'New donor'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                mode === value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'existing' ? (
          <Field label="Donor" required>
            <Select value={form.donor_id} onChange={set('donor_id')}>
              {donors.map((donor) => (
                <option key={donor.id} value={donor.id}>
                  {donor.name} · {donor.city ?? 'India'}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Donor name" required>
              <TextInput value={form.donor_name} onChange={set('donor_name')} placeholder="Full name or company" />
            </Field>
            <Field label="Donor type">
              <Select value={form.donor_type} onChange={set('donor_type')}>
                <option value="individual">Individual</option>
                <option value="corporate">Corporate</option>
                <option value="trust">Trust / foundation</option>
                <option value="anonymous">Anonymous</option>
              </Select>
            </Field>
            <Field label="Email" hint="optional" className="sm:col-span-2">
              <TextInput
                type="email"
                value={form.donor_email}
                onChange={set('donor_email')}
                placeholder="donor@example.com"
              />
            </Field>
          </div>
        )}

        <Field label="Campaign" required hint="Only active campaigns accept donations">
          <Select value={form.campaign_id} onChange={set('campaign_id')}>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.code} · {campaign.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-1 rounded-xl bg-sand-100 p-1">
          {(
            [
              ['monetary', 'Monetary'],
              ['material', 'In-kind / material'],
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

        {form.kind === 'monetary' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (₹)" required>
              <TextInput
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={set('amount')}
                placeholder="5000"
              />
            </Field>
            <Field label="Channel">
              <Select value={form.channel} onChange={set('channel')}>
                {CHANNELS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item" required>
              <TextInput
                value={form.item_name}
                onChange={set('item_name')}
                placeholder="Blankets, school kits, rice bags…"
              />
            </Field>
            <Field label="Unit">
              <TextInput value={form.unit} onChange={set('unit')} placeholder="unit / kit / bag" />
            </Field>
            <Field label="Quantity" required>
              <TextInput type="number" min="0.1" step="1" value={form.quantity} onChange={set('quantity')} />
            </Field>
            <Field label="Estimated value (₹)" hint="optional">
              <TextInput
                type="number"
                min="0"
                step="1"
                value={form.estimated_value}
                onChange={set('estimated_value')}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Donation date" required>
            <TextInput type="date" value={form.donated_at} onChange={set('donated_at')} />
          </Field>
          <Field label="Notes" hint="optional">
            <Textarea value={form.notes} onChange={set('notes')} placeholder="Reference, cheque number, remarks…" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
