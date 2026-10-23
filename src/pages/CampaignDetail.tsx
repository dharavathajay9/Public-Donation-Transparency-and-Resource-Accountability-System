import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Donut, FundFlow, TrendChart } from '../components/Charts'
import {
  Badge,
  Button,
  Card,
  ErrorBlock,
  Icon,
  LoadingBlock,
  ProgressBar,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  cn,
} from '../components/ui'
import { useApi } from '../lib/api'
import {
  CATEGORY_COLORS,
  date,
  inr,
  monthLabel,
  number,
  pct,
  titleCase,
} from '../lib/format'
import type { Campaign } from '../lib/types'

interface CampaignDetailPayload {
  campaign: Campaign
  expenses: Array<{ category: string; entries: number; total: number }>
  donations: Array<{
    receipt_no: string
    kind: string
    amount: number
    item_name: string | null
    quantity: number
    estimated_value: number
    channel: string
    donated_at: string
    donor_name: string
    donor_type: string
  }>
  distributions: Array<{
    reference: string
    amount: number
    quantity: number
    distributed_at: string
    evidence_ref: string | null
    beneficiary_name: string
    location: string
    kind: string
    item_name: string | null
  }>
  monthly: Array<{ month: string; monetary: number }>
}

export default function CampaignDetail() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi<CampaignDetailPayload>(`/public/campaigns/${id}`)
  const [tab, setTab] = useState<'donations' | 'deliveries'>('donations')

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <ErrorBlock message={error} onRetry={reload} />
        <div className="mt-4 text-center">
          <Link to="/campaigns">
            <Button variant="ghost" icon="arrowRight">
              Back to campaigns
            </Button>
          </Link>
        </div>
      </div>
    )
  }
  if (loading || !data) return <LoadingBlock label="Opening the campaign ledger…" />

  const { campaign, expenses, donations, distributions, monthly } = data
  const color = CATEGORY_COLORS[campaign.category] ?? '#1d7360'
  const progress = pct(campaign.raised, campaign.goal_amount)
  const balance = campaign.raised - campaign.spent
  const deliveryCount = campaign.distribution_count ?? distributions.length

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <Link
        to="/campaigns"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-ink-500 transition hover:text-ink-900"
      >
        <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-180" />
        All campaigns
      </Link>

      <Card className="overflow-hidden">
        <div
          className="px-6 pb-6 pt-7 sm:px-8"
          style={{ background: `linear-gradient(135deg, ${color}0f, transparent 65%)` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="outline" className="border-transparent" >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {titleCase(campaign.category)}
                </Badge>
                <StatusBadge status={campaign.status} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                  {campaign.code}
                </span>
              </div>
              <h1 className="display text-3xl leading-tight text-ink-900 sm:text-[40px]">
                {campaign.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {campaign.summary}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
                <span className="flex items-center gap-1.5 font-medium text-ink-700">
                  {campaign.organization_name}
                  {campaign.organization_verified ? (
                    <Icon name="badge" className="h-3.5 w-3.5 text-brand-600" />
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="calendar" className="h-3.5 w-3.5 text-ink-300" />
                  {date(campaign.start_date)} – {campaign.end_date ? date(campaign.end_date) : 'ongoing'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="shield" className="h-3.5 w-3.5 text-ink-300" />
                  Reg. {campaign.organization_registration ?? 'verified'}
                </span>
              </div>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-sand-200 bg-white p-5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">Raised so far</p>
              <p className="display mt-1 text-3xl tabular-nums text-ink-900">{inr(campaign.raised)}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                of {inr(campaign.goal_amount)} goal · {Math.round(progress)}%
              </p>
              <ProgressBar value={progress} max={100} className="mt-3" />
              <div className="mt-4 space-y-2 border-t border-sand-100 pt-3 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-400">In-kind donations</span>
                  <span className="font-medium tabular-nums text-ink-800">{inr(campaign.material_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Donors</span>
                  <span className="font-medium tabular-nums text-ink-800">{number(campaign.donor_count)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Beneficiaries</span>
                  <span className="font-medium tabular-nums text-ink-800">{number(campaign.beneficiary_count)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-400">Deliveries recorded</span>
                  <span className="font-medium tabular-nums text-ink-800">{number(deliveryCount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-px border-t border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Money raised', inr(campaign.raised), 'monetary donations only'],
            ['Allocated', inr(campaign.allocated), `${pct(campaign.allocated, campaign.raised).toFixed(0)}% of funds committed`],
            ['Programme spend', inr(campaign.spent), 'with vouchers on record'],
            ['Balance', inr(balance), 'received minus spent'],
          ].map(([label, value, hint]) => (
            <div key={label} className="bg-white px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{value}</p>
              <p className="mt-0.5 text-[10px] text-ink-400">{hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Fund flow</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                How the received money is committed and utilised.
              </p>
            </div>
            <Badge tone="brand">live</Badge>
          </div>
          <FundFlow raised={campaign.raised} allocated={campaign.allocated} spent={campaign.spent} />
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-sand-100 pt-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">Unallocated</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink-900">
                {inr(Math.max(0, campaign.raised - campaign.allocated))}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">Committed</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink-900">
                {inr(Math.max(0, campaign.allocated - campaign.spent))}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">Utilisation</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink-900">
                {pct(campaign.spent, campaign.allocated || campaign.raised).toFixed(0)}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink-900">Expenditure by category</h2>
          <p className="mb-5 mt-0.5 text-xs text-ink-500">
            {expenses.reduce((sum, item) => sum + item.entries, 0)} vouchers totalling{' '}
            {inr(expenses.reduce((sum, item) => sum + item.total, 0))}
          </p>
          {expenses.length ? (
            <Donut
              data={expenses.map((item) => ({ label: item.category, value: item.total }))}
              centerLabel="Spent"
              centerValue={inr(campaign.spent)}
              size={150}
            />
          ) : (
            <p className="py-8 text-center text-xs text-ink-400">No expenditure recorded yet.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Monthly funding</h2>
            <p className="mt-0.5 text-xs text-ink-500">Monetary donations received each month.</p>
          </div>
          <Badge tone="outline">{monthly.length} months</Badge>
        </div>
        <TrendChart
          data={monthly.map((item) => ({ label: monthLabel(item.month), value: item.monetary }))}
        />
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4">
          <div className="flex gap-1 rounded-xl bg-sand-100 p-1">
            {(
              [
                ['donations', `Donations (${donations.length})`],
                ['deliveries', `Deliveries (${distributions.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-medium transition',
                  tab === key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Immutable ledger records
          </span>
        </div>

        {tab === 'donations' ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Receipt</Th>
                <Th>Donor</Th>
                <Th>Contribution</Th>
                <Th>Channel</Th>
              </tr>
            </thead>
            <tbody>
              {donations.map((donation) => (
                <tr key={donation.receipt_no} className="transition hover:bg-sand-50/60">
                  <Td className="whitespace-nowrap text-ink-500">{date(donation.donated_at)}</Td>
                  <Td className="font-mono text-[11px] text-ink-400">{donation.receipt_no}</Td>
                  <Td>
                    <span className="font-medium text-ink-800">{donation.donor_name}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-400">
                      {donation.donor_type}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap font-medium tabular-nums">
                    {donation.kind === 'monetary'
                      ? inr(donation.amount)
                      : `${donation.quantity} × ${donation.item_name}`}
                  </Td>
                  <Td>
                    <Badge tone="slate">{donation.channel.replace(/_/g, ' ')}</Badge>
                  </Td>
                </tr>
              ))}
              {!donations.length ? (
                <tr>
                  <Td className="py-8 text-center text-ink-400">No donations recorded yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </TableWrap>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Reference</Th>
                <Th>Beneficiary</Th>
                <Th>Delivered</Th>
                <Th>Evidence</Th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((distribution) => (
                <tr key={distribution.reference} className="transition hover:bg-sand-50/60">
                  <Td className="whitespace-nowrap text-ink-500">{date(distribution.distributed_at)}</Td>
                  <Td className="font-mono text-[11px] text-ink-400">{distribution.reference}</Td>
                  <Td>
                    <span className="font-medium text-ink-800">{distribution.beneficiary_name}</span>
                    <span className="ml-2 text-[10px] text-ink-400">{distribution.location}</span>
                  </Td>
                  <Td className="whitespace-nowrap font-medium tabular-nums">
                    {distribution.kind === 'fund'
                      ? inr(distribution.amount)
                      : `${distribution.quantity} × ${distribution.item_name}`}
                  </Td>
                  <Td className="font-mono text-[11px] text-ink-400">
                    {distribution.evidence_ref ?? '—'}
                  </Td>
                </tr>
              ))}
              {!distributions.length ? (
                <tr>
                  <Td className="py-8 text-center text-ink-400">No deliveries recorded yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Icon name="scale" className="h-4 w-4 text-brand-700" />
            Verified organization
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            {campaign.organization_mission ||
              'This organization has submitted its registration documents for verification.'}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-ink-400">
            {campaign.organization_registration}
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Icon name="shield" className="h-4 w-4 text-brand-700" />
            Audit this campaign
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Every donation, allocation, voucher and delivery on this page generated an append-only
            audit entry. Browse the public ledger to see the same trail.
          </p>
          <Link to="/ledger" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Open the public ledger
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </div>
  )
}
