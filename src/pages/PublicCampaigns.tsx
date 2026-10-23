import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CampaignCard } from '../components/CampaignCard'
import { Button, Card, EmptyState, ErrorBlock, Icon, Select, Skeleton, TextInput, cn } from '../components/ui'
import { useApi } from '../lib/api'
import type { Campaign } from '../lib/types'

const CATEGORIES = [
  'all',
  'health',
  'education',
  'disaster_relief',
  'food_security',
  'water',
  'shelter',
  'livelihood',
  'environment',
]

export default function PublicCampaigns() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('progress')

  const query = useMemo(() => {
    const params = new URLSearchParams({ sort })
    if (category !== 'all') params.set('category', category)
    if (search.trim()) params.set('q', search.trim())
    return params.toString()
  }, [category, search, sort])

  const { data, loading, error, reload } = useApi<{ campaigns: Campaign[] }>(`/public/campaigns?${query}`)
  const campaigns = data?.campaigns ?? []
  const totalRaised = campaigns.reduce((sum, campaign) => sum + campaign.raised, 0)

  return (
    <div>
      <section className="border-b border-sand-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Public directory
          </p>
          <h1 className="display mt-2 text-4xl leading-tight text-ink-900 sm:text-5xl">
            Campaigns with nothing to hide
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
            Each campaign below publishes what it raised, how it was allocated, what was spent, and
            who received support. Open any campaign to read its complete ledger.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 font-medium text-brand-800">
              {campaigns.length} campaigns
            </span>
            <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1">
              ₹{(totalRaised / 100000).toFixed(1)} L raised in view
            </span>
            <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1">
              Every entry audit-logged
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
              />
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns, codes or organizations"
                className="pl-10"
                aria-label="Search campaigns"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort campaigns">
                <option value="progress">Most funded</option>
                <option value="raised">Most raised</option>
                <option value="recent">Newest first</option>
              </Select>
            </div>
          </div>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition',
                  category === item
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-sand-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-800',
                )}
              >
                {item === 'all' ? 'All causes' : item.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Card key={index} className="animate-pulse p-5">
                <Skeleton className="mb-4 h-16 w-full" />
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="mb-6 h-3 w-1/2" />
                <Skeleton className="mb-2 h-2 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </Card>
            ))}
          </div>
        ) : campaigns.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.campaign_id} campaign={campaign} />
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sand-200 bg-white px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-ink-900">Verify any campaign independently</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Contributions are recorded by organization staff and published here. The public
                  ledger shows every entry, who recorded it and which record it changed.
                </p>
              </div>
              <Link to="/ledger">
                <Button variant="secondary" icon="shield">
                  Open the public ledger
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              icon="search"
              title="No campaigns match those filters"
              description="Try a different cause or clear your search to see the full directory."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCategory('all')
                    setSearch('')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        )}
      </div>
    </div>
  )
}
