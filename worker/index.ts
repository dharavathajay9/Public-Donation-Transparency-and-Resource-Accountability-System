import { Hono } from 'hono'
import schemaSql from './schema.generated'
import { clearSession, fetchUserById, issueSession, resolveSession, verifyPassword } from './auth'
import { auditStatement, fail, HttpError, sqlErrorToHttp, str } from './lib'
import { clientIp, requireUser } from './guards'
import { seedDatabase } from './seed'
import { splitSql } from './sql'
import type { AppEnv, Env, SessionUser } from './types'
import publicRoutes from './routes/public'
import ledgerRoutes from './routes/ledger'
import directoryRoutes from './routes/directory'
import insightRoutes from './routes/insights'

const app = new Hono<AppEnv>()

let readyPromise: Promise<void> | null = null

async function initialize(env: Env): Promise<void> {
  const table = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
  ).first()
  if (!table) {
    const statements = splitSql(schemaSql)
    for (let i = 0; i < statements.length; i += 25) {
      await env.DB.batch(statements.slice(i, i + 25).map((sql) => env.DB.prepare(sql)))
    }
  }

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
  if ((count?.n ?? 0) === 0) {
    try {
      await seedDatabase(env.DB)
    } catch (error) {
      // A parallel isolate may have seeded first; only surface real failures.
      const check = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
      if ((check?.n ?? 0) === 0) throw error
      console.error('Seed partially failed', error)
    }
  }
}

function ready(env: Env): Promise<void> {
  if (!readyPromise) {
    readyPromise = initialize(env).catch((error) => {
      readyPromise = null
      throw error
    })
  }
  return readyPromise
}

app.use('/api/*', async (c, next) => {
  await ready(c.env)
  const user = await resolveSession(c, c.env.DB)
  c.set('user', user)
  await next()
})

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind('seeded_at')
    .first<{ value: string }>()
  return c.json({ ok: true, seeded_at: row?.value ?? null })
})

app.post('/api/auth/login', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = str(body.email, 'Email', { max: 200 }).toLowerCase()
  const password = str(body.password, 'Password', { max: 200 })

  const row = await c.env.DB.prepare(
    'SELECT id, password_hash, is_active FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: number; password_hash: string; is_active: number }>()

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    fail(401, 'INVALID_CREDENTIALS', 'That email and password combination is not recognised.')
  }
  if (!row.is_active) fail(403, 'ACCOUNT_DISABLED', 'This account has been disabled by an administrator.')

  await issueSession(c, c.env.DB, row.id)
  const user = await fetchUserById(c.env.DB, row.id)
  if (user) {
    await auditStatement(
      c.env.DB,
      user,
      'LOGIN',
      'session',
      user.id,
      `${user.name} signed in`,
      { role: user.role },
      clientIp(c),
    ).run()
  }
  return c.json({ user })
})

app.post('/api/auth/logout', async (c) => {
  const user = c.get('user')
  if (user) {
    await auditStatement(c.env.DB, user, 'LOGOUT', 'session', user.id, `${user.name} signed out`).run()
  }
  await clearSession(c, c.env.DB)
  return c.json({ ok: true })
})

app.get('/api/auth/me', (c) => {
  const user: SessionUser | null = c.get('user')
  return c.json({ user })
})

app.get('/api/meta', async (c) => {
  const user = requireUser(c)
  const orgFilter = user.role === 'staff' ? 'WHERE organization_id = ?' : ''
  const orgParam = user.role === 'staff' ? [user.organization_id] : []

  const campaigns = await c.env.DB.prepare(
    `SELECT campaign_id AS id, code, title, organization_id, organization_name, status,
            goal_amount, raised, allocated, spent
       FROM v_campaign_finance
      ${orgFilter ? 'WHERE organization_id = ?' : ''}
   ORDER BY title`,
  )
    .bind(...orgParam)
    .all()

  const [orgs, donors, beneficiaries] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, verified FROM organizations ORDER BY name').all(),
    c.env.DB.prepare(
      'SELECT id, name, email, donor_type, city FROM donors ORDER BY name LIMIT 500',
    ).all(),
    c.env.DB.prepare(
      `SELECT id, organization_id, name, category, location, household_size
         FROM beneficiaries ${orgFilter ? 'WHERE organization_id = ?' : ''} ORDER BY name`,
    )
      .bind(...orgParam)
      .all(),
  ])

  return c.json({
    organizations: orgs.results,
    campaigns: campaigns.results,
    donors: donors.results,
    beneficiaries: beneficiaries.results,
  })
})

app.route('/api/public', publicRoutes)
app.route('/api', ledgerRoutes)
app.route('/api', directoryRoutes)
app.route('/api', insightRoutes)

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'This API route does not exist.' } }, 404)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status)
  }
  const mapped = sqlErrorToHttp(error)
  if (mapped.status >= 500) console.error('Unhandled API error', error)
  return c.json({ error: { code: mapped.code, message: mapped.message } }, mapped.status)
})

export default app
