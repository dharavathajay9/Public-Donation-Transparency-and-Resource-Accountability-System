import type { Context } from 'hono'
import { canWrite } from './auth'
import { fail } from './lib'
import type { AppEnv, SessionUser } from './types'

export function requireUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user')
  if (!user) fail(401, 'UNAUTHORIZED', 'Please sign in to continue.')
  return user
}

export function requireWriter(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (!canWrite(user.role)) {
    fail(403, 'READ_ONLY_ROLE', 'This account has read-only access.')
  }
  return user
}

export function requireAdmin(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (user.role !== 'admin') fail(403, 'FORBIDDEN', 'Only administrators can perform this action.')
  return user
}

export function requireAuditAccess(c: Context<AppEnv>): SessionUser {
  const user = requireUser(c)
  if (user.role !== 'admin' && user.role !== 'auditor') {
    fail(403, 'FORBIDDEN', 'The audit trail is available to auditors and administrators.')
  }
  return user
}

export function ensureOrgAccess(user: SessionUser, organizationId: number | null): void {
  if (user.role === 'admin') return
  if (user.role === 'staff') {
    if (!organizationId || organizationId !== user.organization_id) {
      fail(403, 'ORG_SCOPE', 'You can only work with records of your own organization.')
    }
    return
  }
  fail(403, 'READ_ONLY_ROLE', 'This account has read-only access.')
}

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? ''
}
