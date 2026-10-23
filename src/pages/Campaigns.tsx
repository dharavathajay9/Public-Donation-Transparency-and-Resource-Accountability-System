import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compactInr, inputDate, number, pct, titleCase } from '../lib/format'
import type { Campaign, Meta } from '../lib/types'
import { CATEGORIES } from '../lib/constants'

const STATUSES = ['draft', 'active', 'paused', 'completed']

export default function Campaigns() {
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === 'admin' || user?.role === 'staff'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(false)

  const params = new URLSearchParams()
  if (search.trim()) params.set('q', search.trim())
  if (status !== 'all') params.set('status', status)
  const { data, loading, error, reload } = useApi<{ campaigns: Campaign[] }>(`/campaigns?${params.toString()}`)
  const meta = useApi<Meta>('/meta')
  const campaigns = data?.campaigns ?? []

  const updateStatus = async (campaign: Campaign, next: string) => {
    try {
      await fetch(`/api/campaigns/${campaign.campaign_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: next }),
      }).then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: { message: string } }
          throw new Error(body.error?.message ?? 'Could not update status.')
        }
      })
      toast.push(`${campaign.code} marked ${next}`)
      reload()
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not update status.', 'error')
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Campaigns"
        description="Each campaign carries its own goal, funding, allocation and expenditure position."
        actions={
          canWrite ? (
            <Button icon="plus" onClick={() => setOpen(true)}>
              New campaign
            </Button>
          ) : (
            <Badge tone="gold">Read-only access</Badge>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ['Campaigns', number(campaigns.length)],
          ['Active', number(campaigns.filter((campaign) => campaign.status === 'active').length)],
          ['Raised', compactInr(campaigns.reduce((sum, campaign) => sum + campaign.raised, 0))],
          ['Unallocated', compactInr(campaigns.reduce((sum, campaign) => sum + Math.max(0, campaign.raised - campaign.allocated), 0))],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{value}</p>
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search campaigns or codes"
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((item) => (
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
        ) : campaigns.length ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Campaign</Th>
                {user?.role === 'admin' ? <Th>Organization</Th> : null}
                <Th className="text-right">Goal</Th>
                <Th className="text-right">Raised</Th>
                <Th className="text-right">Allocated</Th>
                <Th className="text-right">Spent</Th>
                <Th className="min-w-[120px]">Funding</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.campaign_id} className="transition hover:bg-sand-50/60">
                  <Td>
                    <p className="max-w-[260px] truncate text-[13px] font-medium text-ink-900">{campaign.title}</p>
                    <p className="font-mono text-[10px] text-ink-400">
                      {campaign.code} · {titleCase(campaign.category)}
                    </p>
                  </Td>
                  {user?.role === 'admin' ? (
                    <Td className="text-[12px] text-ink-500">{campaign.organization_name}</Td>
                  ) : null}
                  <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">
                    {compactInr(campaign.goal_amount)}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums">{compactInr(campaign.raised)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">{compactInr(campaign.allocated)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">{compactInr(campaign.spent)}</Td>
                  <Td>
                    <ProgressBar value={campaign.progress ?? pct(campaign.raised, campaign.goal_amount)} />
                    <p className="mt-1 text-[10px] text-ink-400">
                      {Math.round(campaign.progress ?? 0)}% · {number(campaign.donor_count)} donors
                    </p>
                  </Td>
                  <Td>
                    {canWrite ? (
                      <Select
                        value={campaign.status}
                        onChange={(event) => updateStatus(campaign, event.target.value)}
                        className="h-8 min-w-[110px] py-0 text-xs"
                      >
                        {STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {titleCase(item)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <StatusBadge status={campaign.status} />
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/campaigns/${campaign.campaign_id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline"
                    >
                      Ledger
                      <Icon name="arrowUpRight" className="h-3 w-3" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            icon="flag"
            title="No campaigns yet"
            description="Create a campaign to start accepting and tracking donations."
            action={canWrite ? <Button icon="plus" onClick={() => setOpen(true)}>New campaign</Button> : undefined}
          />
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 text-[11px] text-ink-400">
        <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only active campaigns accept donations. Changing a campaign to paused or completed blocks new
        contributions at the database level.
      </div>

      {canWrite ? (
        <CampaignModal
          open={open}
          onClose={() => setOpen(false)}
          organizations={meta.data?.organizations ?? []}
          isAdmin={user?.role === 'admin'}
          onSaved={(title) => {
            setOpen(false)
            toast.push(`Campaign “${title}” created`)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}

function CampaignModal({
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
  onSaved: (title: string) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    organization_id: organizations[0] ? String(organizations[0].id) : '',
    title: '',
    category: 'health',
    goal_amount: '',
    start_date: inputDate(),
    end_date: '',
    summary: '',
    description: '',
    status: 'active',
  })

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    if (!form.title.trim() || !form.summary.trim() || !form.goal_amount) {
      toast.push('Title, summary and goal amount are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          organization_id: isAdmin ? Number(form.organization_id) : undefined,
          title: form.title,
          category: form.category,
          goal_amount: Number(form.goal_amount),
          start_date: form.start_date,
          end_date: form.end_date || null,
          summary: form.summary,
          description: form.description,
          status: form.status,
        }),
      })
      const body = (await response.json()) as { error?: { message: string } }
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not create campaign.')
      onSaved(form.title)
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Could not create campaign.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a campaign"
      description="Campaigns are created under your organization with an audit entry."
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} icon="flag">
            Create campaign
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
        <Field label="Campaign title" required>
          <TextInput value={form.title} onChange={set('title')} placeholder="Clean water for 12 villages" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cause category" required>
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Goal amount (₹)" required>
            <TextInput
              type="number"
              min="1000"
              step="1000"
              value={form.goal_amount}
              onChange={set('goal_amount')}
              placeholder="500000"
            />
          </Field>
          <Field label="Start date" required>
            <TextInput type="date" value={form.start_date} onChange={set('start_date')} />
          </Field>
          <Field label="End date" hint="optional">
            <TextInput type="date" value={form.end_date} onChange={set('end_date')} />
          </Field>
        </div>
        <Field label="One-line summary" required>
          <TextInput value={form.summary} onChange={set('summary')} placeholder="What the funds will achieve" />
        </Field>
        <Field label="Description" hint="optional">
          <Textarea value={form.description} onChange={set('description')} rows={3} />
        </Field>
        <Field label="Initial status">
          <Select value={form.status} onChange={set('status')}>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
        </Field>
        <p className="rounded-xl bg-sand-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-500">
          Opening date is used for reporting only. Funds raised become allocatable as soon as
          donations are recorded — up to the exact amount received.
        </p>
      </div>
    </Modal>
  )
}
