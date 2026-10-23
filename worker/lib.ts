import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppEnv, SessionUser } from './types'

export class HttpError extends Error {
  status: ContentfulStatusCode
  code: string
  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function fail(status: ContentfulStatusCode, code: string, message: string): never {
  throw new HttpError(status, code, message)
}

/** Maps database constraint / trigger failures to friendly HTTP errors. */
export function sqlErrorToHttp(error: unknown): HttpError {
  const raw = error instanceof Error ? error.message : String(error)
  const known: Array<[string, HttpError]> = [
    ['ALLOCATION_EXCEEDS_FUNDS', new HttpError(409, 'ALLOCATION_EXCEEDS_FUNDS', 'This allocation is larger than the campaign funds that are still unallocated.')],
    ['ALLOCATION_EXCEEDS_ITEMS', new HttpError(409, 'ALLOCATION_EXCEEDS_ITEMS', 'The campaign does not hold enough donated items of this type to allocate.')],
    ['ORGANIZATION_MISMATCH', new HttpError(409, 'ORGANIZATION_MISMATCH', 'The beneficiary belongs to a different organization than the campaign.')],
    ['EXPENSE_EXCEEDS_ALLOCATED_FUNDS', new HttpError(409, 'EXPENSE_EXCEEDS_ALLOCATED_FUNDS', 'This expense exceeds the funds allocated for the campaign.')],
    ['DISTRIBUTION_EXCEEDS_ALLOCATION', new HttpError(409, 'DISTRIBUTION_EXCEEDS_ALLOCATION', 'This distribution is larger than the pending balance of the allocation.')],
    ['CAMPAIGN_NOT_ACCEPTING_DONATIONS', new HttpError(409, 'CAMPAIGN_NOT_ACCEPTING_DONATIONS', 'This campaign is not currently accepting donations.')],
    ['DONATION_RECORD_IMMUTABLE', new HttpError(409, 'DONATION_RECORD_IMMUTABLE', 'Donation records are immutable; record a correction instead.')],
    ['AUDIT_LOG_IMMUTABLE', new HttpError(409, 'AUDIT_LOG_IMMUTABLE', 'Audit entries are append-only.')],
    ['UNIQUE constraint failed', new HttpError(409, 'DUPLICATE', 'A record with this identifier already exists.')],
    ['FOREIGN KEY constraint failed', new HttpError(409, 'INVALID_REFERENCE', 'A referenced record does not exist.')],
    ['CHECK constraint failed', new HttpError(400, 'INVALID_VALUES', 'Some values do not satisfy the database constraints.')],
    ['NOT NULL constraint failed', new HttpError(400, 'MISSING_FIELD', 'A required field is missing.')],
  ]
  for (const [needle, httpError] of known) {
    if (raw.includes(needle)) return httpError
  }
  return new HttpError(500, 'INTERNAL', 'The database rejected the request.')
}

export function str(value: unknown, field: string, { max = 500, required = true, min = 1 } = {}): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    if (!required) return ''
    fail(400, 'VALIDATION', `${field} is required.`)
  }
  if (text.length < min) fail(400, 'VALIDATION', `${field} is too short.`)
  if (text.length > max) fail(400, 'VALIDATION', `${field} must be under ${max} characters.`)
  return text
}

export function num(value: unknown, field: string, { min = 0, max = 1e12, required = true } = {}): number {
  if (value === undefined || value === null || value === '') {
    if (!required) return 0
    fail(400, 'VALIDATION', `${field} is required.`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) fail(400, 'VALIDATION', `${field} must be a number.`)
  if (parsed < min) fail(400, 'VALIDATION', `${field} must be at least ${min}.`)
  if (parsed > max) fail(400, 'VALIDATION', `${field} is too large.`)
  return Math.round(parsed * 100) / 100
}

export function int(value: unknown, field: string, { min = 1, max = 1e9, required = true } = {}): number {
  const parsed = num(value, field, { min, max, required })
  return Math.trunc(parsed)
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const text = String(value ?? '').trim() as T
  if (!allowed.includes(text)) fail(400, 'VALIDATION', `${field} must be one of: ${allowed.join(', ')}.`)
  return text
}

export function isoDate(value: unknown, field: string, fallbackNow = true): string {
  if (!value) {
    if (!fallbackNow) fail(400, 'VALIDATION', `${field} is required.`)
    return new Date().toISOString()
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) fail(400, 'VALIDATION', `${field} is not a valid date.`)
  const text = String(value)
  // Date-only inputs are stored as a clean calendar date, timestamps as ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return parsed.toISOString()
}

/** Builds an audit entry as a prepared statement so it runs in the same transaction. */
export function auditStatement(
  db: D1Database,
  actor: SessionUser | null,
  action: string,
  entity: string,
  entityId: number | null,
  summary: string,
  meta: Record<string, unknown> = {},
  ip = '',
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      actor?.id ?? null,
      actor?.name ?? 'system',
      actor?.role ?? 'system',
      action,
      entity,
      entityId,
      summary,
      JSON.stringify(meta),
      ip,
    )
}

/** Staff are limited to their own organization; admins and auditors see everything. */
export function orgScopeFor(user: SessionUser | null): number | null {
  if (!user) return null
  if (user.role === 'staff') return user.organization_id
  return null
}

export function money(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function pageParams(c: Context<AppEnv>) {
  const page = Math.max(1, Math.min(10_000, Number(c.req.query('page') ?? 1) || 1))
  const perPage = Math.max(5, Math.min(100, Number(c.req.query('per_page') ?? 25) || 25))
  return { page, perPage, offset: (page - 1) * perPage }
}

export function reference(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3))
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const year = new Date().getUTCFullYear().toString().slice(2)
  return `${prefix}-${year}-${suffix}`
}
