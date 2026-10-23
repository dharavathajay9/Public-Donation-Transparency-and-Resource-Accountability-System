import { Fragment, useState } from 'react'
import {
  Badge,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Icon,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select,
  TableWrap,
  Td,
  TextInput,
  Th,
  cn,
} from '../components/ui'
import { useApi } from '../lib/api'
import { dateTime, relativeTime } from '../lib/format'
import type { AuditEntry } from '../lib/types'

interface AuditResponse {
  entries: AuditEntry[]
  total: number
  actions: Array<{ action: string; n: number }>
  page: number
  per_page: number
}

const ACTION_TONE: Record<string, 'brand' | 'gold' | 'blue' | 'slate' | 'red'> = {
  DONATION: 'brand',
  ALLOCATE: 'blue',
  EXPENSE: 'gold',
  DISTRIBUTE: 'brand',
  STATUS: 'slate',
  AUDIT: 'blue',
  CREATE: 'slate',
  UPDATE: 'gold',
  LOGIN: 'slate',
  LOGOUT: 'slate',
}

export default function Audit() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const params = new URLSearchParams({ page: String(page), per_page: '25' })
  if (action !== 'all') params.set('action', action)
  if (search.trim()) params.set('q', search.trim())
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const { data, loading, error, reload } = useApi<AuditResponse>(`/audit?${params.toString()}`)
  const rows = data?.entries ?? []

  const parseMeta = (meta: string): string => {
    try {
      return JSON.stringify(JSON.parse(meta), null, 2)
    } catch {
      return meta
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Audit trail"
        description="Append-only record of every significant operation, with actor, entity and context."
        actions={
          <Badge tone="gold">
            <Icon name="lock" className="h-3 w-3" />
            Immutable log
          </Badge>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">Total entries</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
            {(data?.total ?? 0).toLocaleString('en-IN')}
          </p>
        </Card>
        {data?.actions.slice(0, 3).map((entry) => (
          <Card key={entry.action} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{entry.action}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{entry.n}</p>
            <p className="text-[10px] text-ink-400">entries</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-sand-200 p-4 lg:grid-cols-[1fr_170px_150px_150px]">
          <div className="relative">
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
              placeholder="Search summary, actor or record id"
              className="pl-10"
            />
          </div>
          <Select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by action"
          >
            <option value="all">All actions</option>
            {data?.actions.map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.action} ({entry.n})
              </option>
            ))}
          </Select>
          <Field label="From" className="[&>span]:hidden">
            <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To" className="[&>span]:hidden">
            <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        ) : loading ? (
          <LoadingBlock label="Reading audit entries…" />
        ) : rows.length ? (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Action</Th>
                  <Th>Summary</Th>
                  <Th>Actor</Th>
                  <Th>Record</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr
                      className={cn(
                        'cursor-pointer transition hover:bg-sand-50/60',
                        expanded === entry.id && 'bg-sand-50/70',
                      )}
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      <Td className="whitespace-nowrap">
                        <span className="block text-[12px] text-ink-700">{relativeTime(entry.created_at)}</span>
                        <span className="block text-[10px] text-ink-400">{dateTime(entry.created_at)}</span>
                      </Td>
                      <Td>
                        <Badge tone={ACTION_TONE[entry.action] ?? 'slate'}>{entry.action}</Badge>
                      </Td>
                      <Td className="max-w-[420px]">
                        <p className="text-[12.5px] leading-relaxed text-ink-700">{entry.summary}</p>
                      </Td>
                      <Td>
                        <p className="text-[12px] text-ink-700">{entry.actor_name}</p>
                        <p className="text-[10px] uppercase tracking-wide text-ink-400">{entry.actor_role}</p>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-400">
                        {entry.entity}
                        {entry.entity_id ? ` #${entry.entity_id}` : ''}
                      </Td>
                      <Td className="text-right text-ink-300">
                        <Icon
                          name="chevronDown"
                          className={cn('ml-auto h-4 w-4 transition', expanded === entry.id && 'rotate-180')}
                        />
                      </Td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </TableWrap>
            <div className="border-t border-sand-200 bg-sand-50/50">
              {expanded ? (
                <pre className="max-h-64 overflow-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-ink-600">
                  {parseMeta(rows.find((row) => row.id === expanded)?.meta ?? '{}')}
                </pre>
              ) : (
                <p className="px-5 py-3 text-[11px] text-ink-400">
                  Select an entry to inspect its structured metadata.
                </p>
              )}
            </div>
            <Pagination page={data?.page ?? 1} perPage={data?.per_page ?? 25} total={data?.total ?? 0} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon="shield"
            title="No audit entries match"
            description="Adjust the filters to review a different slice of the trail."
          />
        )}
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Who', 'Every entry records the actor and their role.'],
          ['What', 'Summary, record type and record id are captured.'],
          ['When', 'Timestamps are written by the database at insert time.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-sand-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
