import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { SessionUser } from './types'

const COOKIE_NAME = 'tl_session'
const ITERATIONS = 100_000
const SESSION_DAYS = 7

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i]
  return diff === 0
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function issueSession(c: Context, db: D1Database, userId: number): Promise<string> {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  await db
    .prepare('DELETE FROM sessions WHERE expires_at < ?')
    .bind(new Date().toISOString())
    .run()
  await db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expires)
    .run()
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
  return token
}

export async function clearSession(c: Context, db: D1Database): Promise<void> {
  const token = getCookie(c, COOKIE_NAME)
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

const USER_SELECT = `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.donor_id,
                            o.name AS organization_name
                       FROM users u
                  LEFT JOIN organizations o ON o.id = u.organization_id`

export async function fetchUserById(db: D1Database, id: number): Promise<SessionUser | null> {
  const row = await db
    .prepare(`${USER_SELECT} WHERE u.id = ? AND u.is_active = 1`)
    .bind(id)
    .first<SessionUser>()
  return row ?? null
}

export async function resolveSession(c: Context, db: D1Database): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const row = await db
    .prepare(
      `SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1`,
    )
    .bind(token, new Date().toISOString())
    .first<{ id: number }>()
  if (!row) return null
  return fetchUserById(db, row.id)
}

export function canWrite(role: string): boolean {
  return role === 'admin' || role === 'staff'
}
