import { Link } from 'react-router-dom'
import { CATEGORY_COLORS, compactInr, date, inr, number, pct, titleCase } from '../lib/format'
import type { Campaign } from '../lib/types'
import { Icon, ProgressBar, StatusBadge, cn } from './ui'

const CATEGORY_ICON: Record<string, string> = {
  health: 'heart',
  education: 'sparkle',
  disaster_relief: 'shield',
  food_security: 'box',
  water: 'layers',
  livelihood: 'scale',
  environment: 'sparkle',
  shelter: 'box',
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = campaign.progress ?? pct(campaign.raised, campaign.goal_amount)
  const color = CATEGORY_COLORS[campaign.category] ?? '#1d7360'
  return (
    <Link to={`/campaigns/${campaign.campaign_id}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift">
        <div
          className="relative flex h-24 items-end justify-between px-5 pb-3"
          style={{ background: `linear-gradient(135deg, ${color}14, ${color}05)` }}
        >
          <div
            className="mb-1 grid h-9 w-9 place-items-center rounded-xl"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <Icon name={CATEGORY_ICON[campaign.category] ?? 'flag'} className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={campaign.status} />
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-px opacity-30"
            style={{ background: color }}
          />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
            {titleCase(campaign.category)}
            <span className="text-ink-300">·</span>
            <span className="normal-case tracking-normal text-ink-400">{campaign.code}</span>
          </div>
          <h3 className="text-[17px] font-semibold leading-snug text-ink-900 transition group-hover:text-brand-800">
            {campaign.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
            {campaign.organization_name}
            {campaign.organization_verified ? (
              <span className="text-brand-600" title="Verified organization">
                <Icon name="badge" className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </p>

          <div className="mt-auto pt-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-semibold tabular-nums text-ink-900">{inr(campaign.raised)}</span>
              <span className="text-[11px] text-ink-400">of {compactInr(campaign.goal_amount)}</span>
            </div>
            <ProgressBar value={progress} max={100} />
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
              <span>{Math.round(progress)}% funded</span>
              {campaign.end_date ? <span>Closes {date(campaign.end_date)}</span> : <span>Ongoing</span>}
            </div>

            <div className={cn('mt-4 flex items-center gap-4 border-t border-sand-100 pt-3 text-[11px] text-ink-500')}>
              <span className="flex items-center gap-1">
                <Icon name="heart" className="h-3.5 w-3.5 text-ink-300" />
                {number(campaign.donor_count)} donors
              </span>
              <span className="flex items-center gap-1">
                <Icon name="users" className="h-3.5 w-3.5 text-ink-300" />
                {number(campaign.beneficiary_count)} served
              </span>
              <span className="ml-auto flex items-center gap-1 font-medium text-brand-700">
                View ledger
                <Icon name="arrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
