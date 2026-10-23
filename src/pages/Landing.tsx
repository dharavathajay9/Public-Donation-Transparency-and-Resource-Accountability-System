import { Link } from 'react-router-dom'
import { CampaignCard } from '../components/CampaignCard'
import { Icon, Badge, Button, Card, Skeleton } from '../components/ui'
import { useApi } from '../lib/api'
import { compactInr, inr, number, relativeTime } from '../lib/format'
import type { Campaign, PublicStats } from '../lib/types'

const ACTION_ICON: Record<string, string> = {
  DONATION: 'heart',
  ALLOCATE: 'share',
  EXPENSE: 'receipt',
  DISTRIBUTE: 'users',
  STATUS: 'flag',
  AUDIT: 'shield',
  CREATE: 'plus',
}

export default function Landing() {
  const stats = useApi<PublicStats>('/public/stats')
  const campaigns = useApi<{ campaigns: Campaign[] }>('/public/campaigns?sort=progress')

  const s = stats.data?.stats
  const featured = (campaigns.data?.campaigns ?? []).slice(0, 3)
  const activity = stats.data?.recent_activity ?? []

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-700/25 blur-[100px]" />
          <div className="absolute -right-32 top-10 h-[420px] w-[420px] rounded-full bg-gold-400/10 blur-[90px]" />
          <div className="grain absolute inset-0 opacity-40" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/75">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Public donation transparency · updated live
            </div>

            <h1 className="display text-[42px] leading-[1.02] tracking-tight sm:text-6xl">
              Every rupee.
              <br />
              Every item.
              <br />
              <span className="italic text-brand-200">Accounted for.</span>
            </h1>

            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/65">
              TrustLedger follows each contribution from the moment it is received to the family it
              reaches — with database-enforced rules, traceable allocations and an audit trail no
              one can quietly rewrite.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/campaigns">
                <Button size="lg" className="bg-white text-brand-900 hover:bg-brand-50" icon="arrowRight">
                  Explore campaigns
                </Button>
              </Link>
              <Link to="/ledger">
                <Button
                  size="lg"
                  variant="ghost"
                  className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                  icon="shield"
                >
                  Open the public ledger
                </Button>
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                ['Raised', s ? compactInr(s.raised) : '—'],
                ['Donations', s ? number(s.donations_count) : '—'],
                ['Audit entries', s ? number(s.audit_entries) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* live ledger card */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-b from-white/10 to-transparent blur-xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Verified ledger
                </div>
                <Badge tone="outline" className="border-white/20 bg-white/5 text-white/70">
                  live
                </Badge>
              </div>

              <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                Total value raised
              </p>
              <p className="display mt-1 text-4xl tabular-nums text-white">
                {s ? inr(s.raised) : <Skeleton className="h-9 w-40 bg-white/10" />}
              </p>
              <p className="mt-1.5 text-xs text-white/45">
                across {s?.campaigns ?? '—'} campaigns and {s?.organizations ?? '—'} verified organizations
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  ['Programme spend', s ? compactInr(s.spent) : '—'],
                  ['Delivered', s ? compactInr(s.distributed_funds) : '—'],
                  ['Donors', s ? number(s.donors) : '—'],
                  ['Beneficiaries', s ? number(s.beneficiaries) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/40">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-white/90">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Latest recorded activity
                </p>
                <ul className="space-y-3">
                  {activity.length
                    ? activity.slice(0, 3).map((entry) => (
                        <li key={entry.id} className="flex gap-3">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-brand-200">
                            <Icon name={ACTION_ICON[entry.action] ?? 'check'} className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs text-white/80">{entry.summary}</p>
                            <p className="mt-0.5 text-[10px] text-white/35">
                              {entry.actor_name} · {relativeTime(entry.created_at)}
                            </p>
                          </div>
                        </li>
                      ))
                    : [0, 1, 2].map((index) => (
                        <li key={index} className="flex gap-3">
                          <Skeleton className="h-6 w-6 rounded-md bg-white/10" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-2.5 w-full bg-white/10" />
                            <Skeleton className="h-2 w-24 bg-white/10" />
                          </div>
                        </li>
                      ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- impact band */}
      <section className="border-b border-sand-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-y-8 px-5 py-10 sm:grid-cols-4">
          {[
            ['Donations recorded', s ? number(s.donations_count) : '—', 'monetary and in-kind'],
            ['Programme expenditure', s ? compactInr(s.spent) : '—', 'with receipt references'],
            ['Beneficiary deliveries', s ? number(s.distributions) : '—', 'signed evidence on file'],
            ['Organizations', s ? number(s.organizations) : '—', 'registration verified'],
          ].map(([label, value, hint]) => (
            <div key={label} className="px-2 sm:border-l sm:border-sand-200 sm:pl-6 sm:first:border-l-0">
              <p className="text-2xl font-semibold tabular-nums text-ink-900 sm:text-[28px]">{value}</p>
              <p className="mt-1 text-xs font-medium text-ink-700">{label}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- campaigns */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Where your money goes
            </p>
            <h2 className="display mt-2 max-w-xl text-3xl leading-tight text-ink-900 sm:text-4xl">
              Campaigns with an open book
            </h2>
            <p className="mt-2 max-w-lg text-sm text-ink-500">
              Every campaign publishes its funding, allocations, expenditure and beneficiary
              deliveries. Follow any one of them down to the last receipt.
            </p>
          </div>
          <Link to="/campaigns">
            <Button variant="secondary" icon="arrowRight">
              All campaigns
            </Button>
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.loading
            ? [0, 1, 2].map((index) => (
                <Card key={index} className="animate-pulse p-5">
                  <Skeleton className="mb-4 h-16 w-full" />
                  <Skeleton className="mb-2 h-4 w-3/4" />
                  <Skeleton className="mb-6 h-3 w-1/2" />
                  <Skeleton className="mb-2 h-2 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </Card>
              ))
            : featured.map((campaign) => <CampaignCard key={campaign.campaign_id} campaign={campaign} />)}
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section id="how" className="border-y border-sand-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                Built for accountability
              </p>
              <h2 className="display mt-2 text-3xl leading-tight text-ink-900 sm:text-4xl">
                Rules the database enforces — not promises
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                Transparency only works when it cannot be edited after the fact. TrustLedger pushes
                the accounting rules into the database itself, so a wrong entry is rejected rather
                than discovered later.
              </p>

              <div className="mt-7 space-y-4">
                {[
                  {
                    icon: 'lock',
                    title: 'Donation records are immutable',
                    text: 'Financial fields can never be rewritten or deleted; corrections are new, logged entries.',
                  },
                  {
                    icon: 'scale',
                    title: 'Allocations cannot exceed funds',
                    text: 'A trigger rejects any allocation larger than the money or goods a campaign actually received.',
                  },
                  {
                    icon: 'receipt',
                    title: 'Expenses stay inside the budget',
                    text: 'Recorded expenditure can never cross the funds allocated for that campaign.',
                  },
                  {
                    icon: 'shield',
                    title: 'Every action is audited',
                    text: 'Append-only audit entries capture who did what, when, and to which record.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3.5">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon name={item.icon} className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">{item.title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-sand-50 p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-900">The money trail</h3>
                <Badge tone="brand">4 checkpoints</Badge>
              </div>
              <ol className="relative space-y-6 border-l border-dashed border-brand-200 pl-6">
                {[
                  ['Donation received', 'Receipt issued, donor recorded, funds locked to a campaign.'],
                  ['Allocation committed', 'Funds or goods assigned to a verified beneficiary with a purpose.'],
                  ['Expense recorded', 'Vouchers and vendors captured against the allocated budget.'],
                  ['Distribution evidenced', 'Handover logged with a reference — visible on the public page.'],
                ].map(([title, text], index) => (
                  <li key={title} className="relative">
                    <span className="absolute -left-[33px] grid h-5 w-5 place-items-center rounded-full border border-brand-200 bg-white text-[10px] font-semibold text-brand-700">
                      {index + 1}
                    </span>
                    <h4 className="text-[13px] font-semibold text-ink-900">{title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{text}</p>
                  </li>
                ))}
              </ol>
              <Link to="/ledger" className="mt-7 flex items-center justify-between rounded-xl border border-brand-200 bg-white px-4 py-3 text-xs font-medium text-brand-800 transition hover:border-brand-400">
                Read the public audit trail
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ ledger */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Nothing hidden
            </p>
            <h2 className="display mt-2 text-3xl text-ink-900 sm:text-4xl">Latest ledger entries</h2>
          </div>
          <Link to="/ledger">
            <Button variant="secondary" icon="arrowRight">
              Full audit trail
            </Button>
          </Link>
        </div>

        <Card className="mt-7 divide-y divide-sand-100 overflow-hidden">
          {activity.length
            ? activity.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon name={ACTION_ICON[entry.action] ?? 'check'} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink-800">{entry.summary}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {entry.actor_name} · {entry.actor_role}
                    </p>
                  </div>
                  <Badge tone="outline">{entry.entity}</Badge>
                  <span className="text-[11px] tabular-nums text-ink-400">{relativeTime(entry.created_at)}</span>
                </div>
              ))
            : [0, 1, 2, 3].map((index) => (
                <div key={index} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
        </Card>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-7 py-12 text-white sm:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="display text-3xl leading-tight sm:text-4xl">
                Follow the money, not just the promise.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Organization staff record and reconcile contributions. Auditors review the trail.
                Donors and the public see the same numbers — always.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/login">
                <Button size="lg" className="bg-white text-brand-900 hover:bg-brand-50" icon="lock">
                  Sign in to workspace
                </Button>
              </Link>
              <Link to="/campaigns">
                <Button
                  size="lg"
                  variant="ghost"
                  className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                >
                  Browse campaigns
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
