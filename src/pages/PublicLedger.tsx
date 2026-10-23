import { useState } from 'react'
import {
  Badge,
  Card,
  EmptyState,
  ErrorBlock,
  Icon,
  LoadingBlock,
  Pagination,
  TableWrap,
  Td,
  Th,
  cn,
} from '../components/ui'
import { useApi } from '../lib/api'
import { dateTime, relativeTime } from '../lib/format'
import type { AuditEntry } from '../lib/types'

const ENTITIES = [
  ['all', 'Everything'],
  ['donation', 'Donations'],
  ['allocation', 'Allocations'],
  ['expense', 'Expenses'],
  ['distribution', 'Deliveries'],
  ['campaign', 'Campaigns'],
] as const

const ACTION_TONE: Record<string, 'brand' | 'gold' | 'blue' | 'slate' | 'red'> = {
  DONATION: 'brand',
  ALLOCATE: 'blue',
  EXPENSE: 'gold',
  DISTRIBUTE: 'brand',
  STATUS: 'slate',
  AUDIT: 'blue',
  CREATE: 'slate',
  LOGIN: 'slate',
}

export default function PublicLedger() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('all')
  const query = `/public/ledger?page=${page}&per_page=25${entity !== 'all' ? `&entity=${entity}` : ''}`
  const { data, loading, error, reload } = useApi<{
    entries: AuditEntry[]
    total: number
    page: number
    per_page: number
  }>(query)

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Public record
        </p>
        <h1 className="display mt-2 text-4xl leading-tight text-ink-900 sm:text-5xl">
          The audit trail
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          Every donation, allocation, voucher and delivery creates an entry here. Records are
          append-only: the database rejects any update or deletion, so history cannot be rewritten.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-brand-800">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-600" />
          Live ledger
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-3 py-1 text-ink-500">
          <Icon name="lock" className="h-3 w-3" />
          Append-only
        </span>
        {data ? (
          <span className="rounded-full border border-sand-200 bg-white px-3 py-1 text-ink-500">
            {data.total.toLocaleString('en-IN')} entries
          </span>
        ) : null}
      </div>

      <div className="no-scrollbar mt-7 flex gap-2 overflow-x-auto pb-1">
        {ENTITIES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setEntity(value)
              setPage(1)
            }}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
              entity === value
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-sand-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="mt-5 overflow-hidden">
        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock label="Reading the ledger…" />
        ) : data && data.entries.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Entry</Th>
                  <Th>Recorded by</Th>
                  <Th className="text-right">Record</Th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id} className="group transition hover:bg-sand-50/60">
                    <Td className="whitespace-nowrap">
                      <span className="block text-[13px] text-ink-700">{relativeTime(entry.created_at)}</span>
                      <span className="block text-[10px] text-ink-400">{dateTime(entry.created_at)}</span>
                    </Td>
                    <Td>
                      <Badge tone={ACTION_TONE[entry.action] ?? 'slate'}>{entry.action}</Badge>
                    </Td>
                    <Td className="max-w-[420px]">
                      <span className="text-[13px] leading-relaxed text-ink-800">{entry.summary}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="block text-[12px] text-ink-700">{entry.actor_name}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-ink-400">
                        {entry.actor_role}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                        {entry.entity}
                        {entry.entity_id ? ` #${entry.entity_id}` : ''}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="shield"
            title="No entries for this filter"
            description="Try a different record type to see the activity trail."
          />
        )}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Append-only', 'Updates and deletes are rejected by database triggers.'],
          ['Actor recorded', 'Every entry names the person and role behind it.'],
          ['Traceable records', 'Each entry links to the donation, voucher or delivery it describes.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-sand-200 bg-white p-4">
            <p className="text-xs font-semibold text-ink-900">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
