import { useState } from 'react'
import { Donut, TrendChart } from '../components/Charts'
import {
  Badge,
  Button,
  Card,
  ErrorBlock,
  Icon,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  TableWrap,
  Td,
  Th,
  useToast,
  cn,
} from '../components/ui'
import { downloadCsv, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  compactInr,
  date,
  dateTime,
  inr,
  monthLabel,
  number,
  pct,
  titleCase,
} from '../lib/format'
import type { Beneficiary, Campaign, Organization } from '../lib/types'

interface ReportData {
  generated_at: string
  totals: { raised: number; material_value: number; allocated: number; spent: number; donations: number }
  campaigns: Campaign[]
  organizations: Organization[]
  expense_categories: Array<{ category: string; total: number; entries: number }>
  monthly: Array<{ month: string; monetary: number; material: number; donations: number }>
  donors: Array<{
    name: string
    donor_type: string
    city: string | null
    donation_count: number
    monetary_total: number
    material_total: number
  }>
  beneficiaries: Beneficiary[]
  integrity: Array<{ key: string; label: string; passed: boolean; detail: string }>
}

export default function Reports() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useApi<ReportData>('/reports')
  const [exporting, setExporting] = useState<string | null>(null)

  if (loading) return <LoadingBlock label="Compiling reports…" />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!data) return null

  const t = data.totals
  const maxDonor = Math.max(...data.donors.map((donor) => donor.monetary_total + donor.material_total), 1)
  const passedChecks = data.integrity.filter((check) => check.passed).length

  const exportCsv = async (type: string) => {
    setExporting(type)
    try {
      await downloadCsv(type)
      toast.push(`${titleCase(type)} export downloaded`)
    } catch (cause) {
      toast.push(cause instanceof Error ? cause.message : 'Export failed.', 'error')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Reports & accountability"
        description={`Financial statements, donor analysis and integrity verification · generated ${dateTime(data.generated_at)}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="download" loading={exporting === 'donations'} onClick={() => exportCsv('donations')}>
              Donations CSV
            </Button>
            <Button variant="secondary" size="sm" icon="download" loading={exporting === 'expenses'} onClick={() => exportCsv('expenses')}>
              Expenses CSV
            </Button>
            <Button variant="secondary" size="sm" icon="download" loading={exporting === 'allocations'} onClick={() => exportCsv('allocations')}>
              Allocations CSV
            </Button>
            <Button size="sm" variant="dark" icon="printer" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Money raised', inr(t.raised), 'monetary donations'],
          ['In-kind value', inr(t.material_value), 'materials received'],
          ['Allocated', inr(t.allocated), `${pct(t.allocated, t.raised).toFixed(0)}% of funds`],
          ['Programme spend', inr(t.spent), `${pct(t.spent, t.allocated || t.raised).toFixed(0)}% of allocations`],
          ['Unallocated', inr(Math.max(0, t.raised - t.allocated)), 'available to commit'],
        ].map(([label, value, hint]) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{value}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">{hint}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Icon name="shield" className="h-4 w-4 text-brand-700" />
              Integrity verification
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">
              Continuous checks executed against the live database.
            </p>
          </div>
          <Badge tone={passedChecks === data.integrity.length ? 'brand' : 'red'}>
            {passedChecks}/{data.integrity.length} checks passed
          </Badge>
        </div>
        <div className="grid gap-px bg-sand-200 sm:grid-cols-2 lg:grid-cols-5">
          {data.integrity.map((check) => (
            <div key={check.key} className="bg-white p-4">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                    check.passed ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-600',
                  )}
                >
                  <Icon name={check.passed ? 'check' : 'alert'} className="h-3 w-3" />
                </span>
                <div>
                  <p className="text-[11px] font-medium leading-snug text-ink-800">{check.label}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">{check.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Monthly contributions</h2>
              <p className="text-xs text-ink-400">Monetary value received per month</p>
            </div>
            <Badge tone="outline">{data.monthly.length} months</Badge>
          </div>
          <TrendChart
            data={data.monthly.map((month) => ({ label: monthLabel(month.month), value: month.monetary }))}
          />
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink-900">Expenditure mix</h2>
          <p className="mb-4 mt-0.5 text-xs text-ink-400">Programme spend by category</p>
          {data.expense_categories.length ? (
            <Donut
              data={data.expense_categories.map((item) => ({ label: item.category, value: item.total }))}
              size={150}
              centerLabel="Spent"
              centerValue={compactInr(t.spent)}
            />
          ) : (
            <p className="py-10 text-center text-xs text-ink-400">No expenditure recorded.</p>
          )}
        </Card>
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Campaign-wise statement</h2>
          <p className="text-xs text-ink-400">Goal, funding, allocation, expenditure and balance</p>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th className="text-right">Goal</Th>
              <Th className="text-right">Raised</Th>
              <Th className="text-right">Allocated</Th>
              <Th className="text-right">Spent</Th>
              <Th className="text-right">Balance</Th>
              <Th className="min-w-[110px]">Progress</Th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((campaign) => (
              <tr key={campaign.campaign_id} className="transition hover:bg-sand-50/60">
                <Td>
                  <p className="text-[13px] font-medium text-ink-900">{campaign.title}</p>
                  <p className="text-[10px] text-ink-400">
                    {campaign.organization_name} · {campaign.code}
                  </p>
                </Td>
                <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">{compactInr(campaign.goal_amount)}</Td>
                <Td className="whitespace-nowrap text-right font-medium tabular-nums">{compactInr(campaign.raised)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">{compactInr(campaign.allocated)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums text-ink-500">{compactInr(campaign.spent)}</Td>
                <Td className="whitespace-nowrap text-right tabular-nums">{compactInr(campaign.raised - campaign.spent)}</Td>
                <Td>
                  <ProgressBar value={campaign.progress ?? pct(campaign.raised, campaign.goal_amount)} />
                  <span className="mt-1 block text-[10px] text-ink-400">
                    {Math.round(campaign.progress ?? 0)}%
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sand-50">
              <Td className="font-semibold text-ink-900">Total</Td>
              <Td className="text-right tabular-nums text-ink-500">
                {compactInr(data.campaigns.reduce((sum, campaign) => sum + campaign.goal_amount, 0))}
              </Td>
              <Td className="text-right font-semibold tabular-nums">{compactInr(t.raised)}</Td>
              <Td className="text-right tabular-nums text-ink-500">{compactInr(t.allocated)}</Td>
              <Td className="text-right tabular-nums text-ink-500">{compactInr(t.spent)}</Td>
              <Td className="text-right font-semibold tabular-nums">{compactInr(t.raised - t.spent)}</Td>
              <Td />
            </tr>
          </tfoot>
        </TableWrap>
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-sand-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Organization summary</h2>
            <p className="text-xs text-ink-400">Raised compared with programme spend</p>
          </div>
          <TableWrap>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th className="text-right">Campaigns</Th>
                <Th className="text-right">Raised</Th>
                <Th className="text-right">Spent</Th>
              </tr>
            </thead>
            <tbody>
              {data.organizations.map((organization) => (
                <tr key={organization.id} className="transition hover:bg-sand-50/60">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-ink-900">{organization.name}</span>
                      {organization.verified ? (
                        <Icon name="badge" className="h-3.5 w-3.5 text-brand-600" />
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums text-ink-500">{organization.campaigns}</Td>
                  <Td className="text-right font-medium tabular-nums">{compactInr(organization.raised)}</Td>
                  <Td className="text-right tabular-nums text-ink-500">{compactInr(organization.spent)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Top donors</h2>
              <p className="text-xs text-ink-400">By total contribution value</p>
            </div>
            <Badge tone="outline">{data.donors.length}</Badge>
          </div>
          <ul className="space-y-3">
            {data.donors.slice(0, 8).map((donor) => {
              const total = donor.monetary_total + donor.material_total
              return (
                <li key={donor.name}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-ink-700">
                      {donor.name}
                      <span className="ml-1.5 text-[10px] capitalize text-ink-400">{donor.donor_type}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-800">
                      {compactInr(total)}
                    </span>
                  </div>
                  <ProgressBar value={total} max={maxDonor} tone={donor.donor_type === 'individual' ? 'brand' : 'blue'} />
                </li>
              )
            })}
            {!data.donors.length ? (
              <li className="py-6 text-center text-xs text-ink-400">No donors yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-sand-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Beneficiary support</h2>
          <p className="text-xs text-ink-400">Value delivered to the top-supported beneficiaries</p>
        </div>
        <TableWrap>
          <thead>
            <tr>
              <Th>Beneficiary</Th>
              <Th>Location</Th>
              <Th className="text-right">Allocations</Th>
              <Th className="text-right">Funds allocated</Th>
              <Th className="text-right">Funds received</Th>
              <Th className="text-right">Deliveries</Th>
            </tr>
          </thead>
          <tbody>
            {data.beneficiaries.map((beneficiary) => (
              <tr key={beneficiary.id} className="transition hover:bg-sand-50/60">
                <Td>
                  <p className="text-[13px] font-medium text-ink-900">{beneficiary.name}</p>
                  <p className="text-[10px] text-ink-400">{titleCase(beneficiary.category)}</p>
                </Td>
                <Td className="text-ink-500">{beneficiary.location}</Td>
                <Td className="text-right tabular-nums text-ink-500">{beneficiary.allocation_count}</Td>
                <Td className="text-right tabular-nums text-ink-500">{inr(beneficiary.funds_allocated)}</Td>
                <Td className="text-right font-medium tabular-nums">{inr(beneficiary.funds_received)}</Td>
                <Td className="text-right tabular-nums text-ink-500">{number(beneficiary.distributions_received)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <p className="no-print mt-4 text-[11px] text-ink-400">
        Report generated {date(data.generated_at)} for {user?.role === 'staff' ? user.organization_name : 'all organizations'}.
        Values are computed directly from the relational views {user?.role === 'staff' ? '' : ''}v_campaign_finance and
        v_organization_summary.
      </p>
    </div>
  )
}
