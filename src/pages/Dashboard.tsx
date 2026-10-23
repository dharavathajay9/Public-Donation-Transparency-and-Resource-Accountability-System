import { Link } from 'react-router-dom'
import { Donut, FundFlow, TrendChart } from '../components/Charts'
import {
  Badge,
  Card,
  ErrorBlock,
  Icon,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  cn,
} from '../components/ui'
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  compactInr,
  date,
  inr,
  monthLabel,
  number,
  pct,
  relativeTime,
  titleCase,
} from '../lib/format'
import type { DashboardData } from '../lib/types'

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: string
  hint?: string
  icon: string
  tone?: 'brand' | 'gold' | 'blue' | 'slate'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    gold: 'bg-gold-100 text-gold-700',
    blue: 'bg-sky-50 text-sky-700',
    slate: 'bg-sand-100 text-ink-500',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">{label}</p>
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', tones[tone])}>
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p> : null}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard')

  if (loading) return <LoadingBlock label="Preparing your workspace…" />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!data || !user) return null

  if (user.role === 'donor') return <DonorDashboard data={data} name={user.name} />
  if (user.role === 'auditor') return <AuditorDashboard data={data} reload={reload} />
  return <OperationsDashboard data={data} name={user.name} role={user.role} />
}

/* ------------------------------------------------------------ operations */

function OperationsDashboard({
  data,
  name,
  role,
}: {
  data: DashboardData
  name: string
  role: string
}) {
  const k = data.kpis
  const campaigns = data.campaigns ?? []
  const topCampaigns = [...campaigns].sort((a, b) => b.raised - a.raised).slice(0, 5)
  const monthly = (data.monthly ?? []).slice(-9)
  const expenseData = (data.expense_categories ?? []).map((item) => ({
    label: item.category,
    value: item.total,
  }))
  const auditActivity = data.activity_kind === 'audit'

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name.split(' ')[0]

  return (
    <div className="animate-rise">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${data.scope_label ?? 'All organizations'} · ${date(new Date().toISOString())}`}
        actions={
          <>
            <Link to="/app/reports">
              <button className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-3 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-800">
                <Icon name="chart" className="h-3.5 w-3.5" />
                Reports
              </button>
            </Link>
            <Link to="/app/donations">
              <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-xs font-medium text-white transition hover:bg-brand-800">
                <Icon name="plus" className="h-3.5 w-3.5" />
                Record donation
              </button>
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Raised"
          value={inr(k.raised ?? 0)}
          hint={`${number(k.donations ?? 0)} donations · ${number(k.active_campaigns ?? 0)} active campaigns`}
          icon="heart"
        />
        <KpiCard
          label="Allocated"
          value={inr(k.allocated ?? 0)}
          hint={`${pct(k.allocated ?? 0, k.raised ?? 0).toFixed(0)}% of funds committed`}
          icon="share"
          tone="blue"
        />
        <KpiCard
          label="Programme spend"
          value={inr(k.spent ?? 0)}
          hint={`${number(k.expense_entries ?? 0)} vouchers recorded`}
          icon="receipt"
          tone="gold"
        />
        <KpiCard
          label="Balance"
          value={inr(k.balance ?? 0)}
          hint="received minus spent"
          icon="scale"
        />
        <KpiCard
          label="Beneficiaries"
          value={number(k.beneficiaries ?? 0)}
          hint={`${number(k.distributions ?? 0)} deliveries logged`}
          icon="users"
          tone="slate"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Donation inflow</h2>
              <p className="text-xs text-ink-400">Monetary contributions by month</p>
            </div>
            <Badge tone="outline">{monthly.length} months</Badge>
          </div>
          <TrendChart
            data={monthly.map((item) => ({ label: monthLabel(item.month), value: item.monetary }))}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Expense mix</h2>
              <p className="text-xs text-ink-400">Where programme money is going</p>
            </div>
          </div>
          {expenseData.length ? (
            <Donut
              data={expenseData.slice(0, 6)}
              size={140}
              thickness={18}
              centerLabel="Spent"
              centerValue={compactInr(k.spent ?? 0)}
            />
          ) : (
            <p className="py-10 text-center text-xs text-ink-400">No expenditure recorded yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Campaign performance</h2>
              <p className="text-xs text-ink-400">Funding against allocation and spend</p>
            </div>
            <Link to="/app/campaigns" className="text-xs font-medium text-brand-700 hover:underline">
              Manage
            </Link>
          </div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th className="text-right">Raised</Th>
                <Th className="text-right">Spent</Th>
                <Th className="min-w-[130px]">Progress</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map((campaign) => (
                <tr key={campaign.campaign_id} className="transition hover:bg-sand-50/60">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold text-brand-700">
                        {campaign.code.split('-')[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">{campaign.title}</p>
                        <p className="truncate text-[10px] text-ink-400">{campaign.organization_name}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                    {compactInr(campaign.raised)}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">
                    {compactInr(campaign.spent)}
                  </Td>
                  <Td>
                    <ProgressBar value={campaign.progress ?? pct(campaign.raised, campaign.goal_amount)} />
                    <span className="mt-1 block text-[10px] text-ink-400">
                      {Math.round(campaign.progress ?? 0)}% of {compactInr(campaign.goal_amount)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <StatusBadge status={campaign.status} />
                  </Td>
                </tr>
              ))}
              {!topCampaigns.length ? (
                <tr>
                  <Td className="py-8 text-center text-xs text-ink-400">No campaigns yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </TableWrap>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">
                {auditActivity ? 'Recent activity' : 'Recent donations'}
              </h2>
              {role === 'admin' || role === 'auditor' ? (
                <Link to="/app/audit" className="text-xs font-medium text-brand-700 hover:underline">
                  Audit trail
                </Link>
              ) : (
                <Link to="/app/donations" className="text-xs font-medium text-brand-700 hover:underline">
                  All
                </Link>
              )}
            </div>
            <ul className="space-y-3">
              {(data.activity ?? []).slice(0, 5).map((entry, index) => (
                <li key={`${entry.id ?? index}-${index}`} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sand-100 text-ink-500">
                    <Icon
                      name={
                        auditActivity
                          ? entry.action === 'DONATION'
                            ? 'heart'
                            : entry.action === 'ALLOCATE'
                              ? 'share'
                              : entry.action === 'EXPENSE'
                                ? 'receipt'
                                : entry.action === 'DISTRIBUTE'
                                  ? 'users'
                                  : 'shield'
                          : 'heart'
                      }
                      className="h-3 w-3"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[11.5px] leading-snug text-ink-700">
                      {entry.summary ??
                        `${entry.receipt_no} · ${inr(entry.amount ?? 0)} from ${entry.donor_name}`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {auditActivity ? entry.actor_name : entry.donor_name} ·{' '}
                      {relativeTime(entry.created_at ?? entry.donated_at ?? new Date().toISOString())}
                    </p>
                  </div>
                </li>
              ))}
              {!(data.activity ?? []).length ? (
                <li className="py-6 text-center text-[11px] text-ink-400">Nothing recorded yet.</li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-900">Delivery pipeline</h2>
            <p className="mb-4 text-xs text-ink-400">
              {number(k.pending_allocations ?? 0)} allocations awaiting full delivery
            </p>
            <div className="space-y-3">
              {(data.allocation_status ?? []).map((status) => (
                <div key={status.status}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="capitalize text-ink-600">{status.status.replace(/_/g, ' ')}</span>
                    <span className="tabular-nums text-ink-400">{number(status.n)}</span>
                  </div>
                  <ProgressBar
                    value={status.n}
                    max={Math.max(1, ...(data.allocation_status ?? []).map((item) => item.n))}
                    tone={status.status === 'distributed' ? 'brand' : status.status === 'partially_distributed' ? 'blue' : 'gold'}
                  />
                </div>
              ))}
              {!(data.allocation_status ?? []).length ? (
                <p className="text-[11px] text-ink-400">No allocations recorded yet.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5 flex flex-wrap items-center gap-4 border-brand-100 bg-gradient-to-r from-brand-50 to-white p-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
          <Icon name="shield" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-900">Database rules are protecting this ledger</p>
          <p className="text-[11px] text-ink-500">
            Allocations cannot exceed received funds, expenses cannot exceed allocations, and
            donation records are immutable.
          </p>
        </div>
        <Link to="/app/reports">
          <span className="text-xs font-medium text-brand-700 hover:underline">View integrity report</span>
        </Link>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- auditor */

function AuditorDashboard({ data, reload }: { data: DashboardData; reload: () => void }) {
  const k = data.kpis
  const campaigns = data.campaigns ?? []
  return (
    <div className="animate-rise">
      <PageHeader
        title="Audit overview"
        description="Read-only review of every financial and resource record across organizations."
        actions={
          <>
            <Link to="/app/audit">
              <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-xs font-medium text-white hover:bg-brand-800">
                <Icon name="shield" className="h-3.5 w-3.5" />
                Open audit trail
              </button>
            </Link>
            <button
              type="button"
              onClick={reload}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-3 text-xs font-medium text-ink-700 hover:border-brand-300"
            >
              <Icon name="clock" className="h-3.5 w-3.5" />
              Refresh
            </button>
          </>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-100/60 px-4 py-3">
        <Icon name="eye" className="mt-0.5 h-4 w-4 text-gold-700" />
        <p className="text-xs leading-relaxed text-gold-700">
          Auditor accounts can read every record and the full audit trail, but cannot create,
          modify or delete anything. Write controls are hidden on all pages.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total raised" value={inr(k.raised ?? 0)} hint="across all organizations" icon="heart" />
        <KpiCard label="Programme spend" value={inr(k.spent ?? 0)} hint={`${number(k.expense_entries ?? 0)} vouchers`} icon="receipt" tone="gold" />
        <KpiCard label="Delivered to beneficiaries" value={inr(k.distributed_value ?? 0)} hint={`${number(k.distributions ?? 0)} deliveries`} icon="users" tone="blue" />
        <KpiCard label="Audit entries" value={number(k.audit_entries ?? 0)} hint="append-only since inception" icon="shield" tone="slate" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Fund flow across the platform</h2>
          <FundFlow raised={k.raised ?? 0} allocated={k.allocated ?? 0} spent={k.spent ?? 0} />
          <div className="mt-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-ink-400">Unallocated</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink-900">{inr(k.available ?? 0)}</p>
            </div>
            <div>
              <p className="text-ink-400">Pending allocations</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink-900">{number(k.pending_allocations ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Latest ledger entries</h2>
            <Link to="/app/audit" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {(data.activity ?? []).slice(0, 6).map((entry) => (
              <li key={entry.id} className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11.5px] leading-snug text-ink-700">{entry.summary}</p>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    {entry.actor_name} · {relativeTime(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
            {!(data.activity ?? []).length ? (
              <li className="py-6 text-center text-[11px] text-ink-400">No activity yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Campaign financial position</h2>
          <p className="text-xs text-ink-400">Raised, allocated and spent for each campaign</p>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th>Organization</Th>
              <Th className="text-right">Raised</Th>
              <Th className="text-right">Allocated</Th>
              <Th className="text-right">Spent</Th>
              <Th className="text-right">Balance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.campaign_id} className="transition hover:bg-sand-50/60">
                <Td className="font-medium text-ink-900">{campaign.title}</Td>
                <Td className="text-ink-500">{campaign.organization_name}</Td>
                <Td className="text-right tabular-nums">{inr(campaign.raised)}</Td>
                <Td className="text-right tabular-nums text-ink-500">{inr(campaign.allocated)}</Td>
                <Td className="text-right tabular-nums text-ink-500">{inr(campaign.spent)}</Td>
                <Td className="text-right font-medium tabular-nums">{inr(campaign.raised - campaign.spent)}</Td>
                <Td>
                  <StatusBadge status={campaign.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ donor */

function DonorDashboard({ data, name }: { data: DashboardData; name: string }) {
  const k = data.kpis
  const donations = data.donations ?? []
  const campaigns = data.campaigns ?? []
  return (
    <div className="animate-rise">
      <PageHeader
        title={`Your giving, ${name.split(' ')[0]}`}
        description="A personal record of every contribution you have made through TrustLedger."
        actions={
          <Link to="/campaigns">
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-xs font-medium text-white hover:bg-brand-800">
              <Icon name="heart" className="h-3.5 w-3.5" />
              Support a campaign
            </button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total given" value={inr(k.given ?? 0)} hint={`${number(k.count ?? 0)} contributions`} icon="heart" />
        <KpiCard label="In-kind value" value={inr(k.in_kind ?? 0)} hint="materials and goods" icon="box" tone="blue" />
        <KpiCard label="Campaigns supported" value={number(k.campaigns ?? 0)} hint="across all causes" icon="flag" tone="gold" />
        <KpiCard label="Last contribution" value={k.last_at ? date(k.last_at) : '—'} hint="thank you" icon="clock" tone="slate" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Your contributions</h2>
            <p className="text-xs text-ink-400">Each receipt is permanently recorded</p>
          </div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Campaign</Th>
                <Th>Receipt</Th>
                <Th className="text-right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {donations.map((donation) => (
                <tr key={donation.receipt_no} className="transition hover:bg-sand-50/60">
                  <Td className="whitespace-nowrap text-ink-500">{date(donation.donated_at)}</Td>
                  <Td>
                    <p className="font-medium text-ink-900">{donation.campaign_title}</p>
                    <p className="text-[10px] text-ink-400">{donation.organization_name}</p>
                  </Td>
                  <Td className="font-mono text-[10px] text-ink-400">{donation.receipt_no}</Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                    {donation.kind === 'monetary'
                      ? inr(donation.amount)
                      : `${donation.quantity} × ${donation.item_name}`}
                  </Td>
                </tr>
              ))}
              {!donations.length ? (
                <tr>
                  <Td className="py-10 text-center text-xs text-ink-400">
                    No contributions yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableWrap>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Campaigns you support</h2>
          <div className="space-y-4">
            {campaigns.slice(0, 4).map((campaign) => (
              <Link key={campaign.campaign_id} to={`/campaigns/${campaign.campaign_id}`} className="block">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-xs font-medium text-ink-800">{campaign.title}</p>
                  <span className="text-[10px] tabular-nums text-ink-400">
                    {Math.round(campaign.progress ?? 0)}%
                  </span>
                </div>
                <ProgressBar value={campaign.progress ?? 0} />
                <p className="mt-1 text-[10px] text-ink-400">
                  {titleCase(campaign.status)} · {inr(campaign.raised)} raised
                </p>
              </Link>
            ))}
            {!campaigns.length ? (
              <p className="py-6 text-center text-[11px] text-ink-400">No campaigns yet.</p>
            ) : null}
          </div>
          <Link
            to="/campaigns"
            className="mt-5 flex items-center justify-between rounded-xl border border-sand-200 px-3.5 py-2.5 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-800"
          >
            Explore all campaigns
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <Card className="mt-5 flex flex-wrap items-center gap-4 border-brand-100 bg-gradient-to-r from-brand-50 to-white p-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Your contribution is locked into the ledger</p>
          <p className="mt-0.5 text-xs text-ink-500">
            Donation records cannot be edited or deleted. Every allocation and delivery made with
            campaign funds is published on the public campaign page.
          </p>
        </div>
        <Link to="/campaigns" className="text-xs font-medium text-brand-700 hover:underline">
          See where funds go
        </Link>
      </Card>
    </div>
  )
}
