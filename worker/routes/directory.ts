import { Hono } from 'hono'
import { hashPassword } from '../auth'
import { auditStatement, fail, int, isoDate, num, oneOf, pageParams, reference, str } from '../lib'
import { clientIp, ensureOrgAccess, requireAdmin, requireUser, requireWriter } from '../guards'
import { CATEGORIES, type AppEnv } from '../types'

const directoryRoutes = new Hono<AppEnv>()

// ---------------------------------------------------------------- campaigns

directoryRoutes.get('/campaigns', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Campaign workspaces are not available to donor accounts.')

  const clauses: string[] = []
  const params: unknown[] = []
  if (user.role === 'staff') {
    clauses.push('organization_id = ?')
    params.push(user.organization_id)
  }
  const status = c.req.query('status')
  if (status && status !== 'all') {
    clauses.push('status = ?')
    params.push(status)
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(title LIKE ? OR code LIKE ? OR organization_name LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const rows = await c.env.DB.prepare(
    `SELECT *, (raised * 1.0 / goal_amount) AS progress,
            (raised - allocated) AS unallocated,
            (raised - spent) AS balance,
            (allocated - spent) AS committed_balance
       FROM v_campaign_finance ${where}
   ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, start_date DESC`,
  )
    .bind(...params)
    .all()

  return c.json({ campaigns: rows.results })
})

directoryRoutes.post('/campaigns', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  let organizationId: number
  if (user.role === 'admin') {
    organizationId = int(body.organization_id, 'Organization')
    const org = await c.env.DB.prepare('SELECT id FROM organizations WHERE id = ?')
      .bind(organizationId)
      .first()
    if (!org) fail(404, 'NOT_FOUND', 'Organization not found.')
  } else {
    if (!user.organization_id) fail(403, 'ORG_SCOPE', 'Your account is not linked to an organization.')
    organizationId = user.organization_id
  }

  const title = str(body.title, 'Campaign title', { max: 140 })
  const summary = str(body.summary, 'Summary', { max: 300 })
  const description = str(body.description, 'Description', { required: false, max: 4000 })
  const category = oneOf(body.category, CATEGORIES, 'Category')
  const goalAmount = num(body.goal_amount, 'Goal amount', { min: 1000 })
  const startDate = isoDate(body.start_date, 'Start date', false)
  const endDate = body.end_date ? isoDate(body.end_date, 'End date', false) : null
  const status = oneOf(body.status ?? 'active', ['draft', 'active', 'paused', 'completed'] as const, 'Status')

  const initials = title
    .split(/\s+/)
    .filter((word) => /^[a-zA-Z]/.test(word))
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('') || 'CMP'
  const code = `${initials}-${new Date().getUTCFullYear().toString().slice(2)}-${reference('X').split('-')[2]}`

  const result = await c.env.DB.prepare(
    `INSERT INTO campaigns (organization_id, code, title, summary, description, category,
                            goal_amount, status, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(organizationId, code, title, summary, description, category, goalAmount, status, startDate, endDate, user.id)
    .run()

  const campaignId = Number(result.meta.last_row_id)
  await auditStatement(
    c.env.DB, user, 'CREATE', 'campaign', campaignId,
    `Created campaign ${title} with a goal of ₹${goalAmount.toLocaleString('en-IN')}`,
    { code, category, goal_amount: goalAmount },
    clientIp(c),
  ).run()

  const created = await c.env.DB.prepare('SELECT * FROM v_campaign_finance WHERE campaign_id = ?')
    .bind(campaignId)
    .first()
  return c.json({ campaign: created }, 201)
})

directoryRoutes.patch('/campaigns/:id', async (c) => {
  const user = requireWriter(c)
  const id = int(c.req.param('id'), 'Campaign')
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const status = oneOf(body.status, ['draft', 'active', 'paused', 'completed'] as const, 'Status')

  const campaign = await c.env.DB.prepare(
    'SELECT id, title, code, status, organization_id FROM campaigns WHERE id = ?',
  )
    .bind(id)
    .first<{ id: number; title: string; code: string; status: string; organization_id: number }>()
  if (!campaign) fail(404, 'NOT_FOUND', 'Campaign not found.')
  ensureOrgAccess(user, campaign.organization_id)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE campaigns SET status = ? WHERE id = ?').bind(status, id),
    auditStatement(
      c.env.DB, user, 'STATUS', 'campaign', id,
      `Changed status of ${campaign.code} from ${campaign.status} to ${status}`,
      { previous: campaign.status, next: status },
      clientIp(c),
    ),
  ])

  const updated = await c.env.DB.prepare('SELECT * FROM v_campaign_finance WHERE campaign_id = ?')
    .bind(id)
    .first()
  return c.json({ campaign: updated })
})

// ------------------------------------------------------------ beneficiaries

directoryRoutes.get('/beneficiaries', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Beneficiary records are not visible to donor accounts.')

  const { page, perPage, offset } = pageParams(c)
  const clauses: string[] = []
  const params: unknown[] = []
  if (user.role === 'staff') {
    clauses.push('organization_id = ?')
    params.push(user.organization_id)
  }
  const category = c.req.query('category')
  if (category && category !== 'all') {
    clauses.push('category = ?')
    params.push(category)
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(name LIKE ? OR location LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM v_beneficiary_support ${where}
   ORDER BY funds_received DESC, name LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM v_beneficiary_support ${where}`)
      .bind(...params)
      .first<{ n: number }>(),
  ])

  return c.json({ beneficiaries: rows.results, total: total?.n ?? 0, page, per_page: perPage })
})

directoryRoutes.post('/beneficiaries', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  let organizationId: number
  if (user.role === 'admin') {
    organizationId = int(body.organization_id, 'Organization')
  } else {
    if (!user.organization_id) fail(403, 'ORG_SCOPE', 'Your account is not linked to an organization.')
    organizationId = user.organization_id
  }
  ensureOrgAccess(user, organizationId)

  const name = str(body.name, 'Beneficiary name', { max: 140 })
  const category = oneOf(body.category, ['family', 'school', 'shelter', 'patient', 'farmers', 'students', 'individual', 'community'] as const, 'Beneficiary type')
  const location = str(body.location, 'Location', { max: 160 })
  const householdSize = int(body.household_size ?? 1, 'Household size', { min: 1, max: 100000 })
  const contact = str(body.contact, 'Contact', { required: false, max: 40 })

  const result = await c.env.DB.prepare(
    'INSERT INTO beneficiaries (organization_id, name, category, location, household_size, contact) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(organizationId, name, category, location, householdSize, contact || null)
    .run()
  const beneficiaryId = Number(result.meta.last_row_id)

  await auditStatement(
    c.env.DB, user, 'CREATE', 'beneficiary', beneficiaryId,
    `Registered beneficiary ${name} (${location})`,
    { category, household_size: householdSize },
    clientIp(c),
  ).run()

  const created = await c.env.DB.prepare('SELECT * FROM v_beneficiary_support WHERE id = ?')
    .bind(beneficiaryId)
    .first()
  return c.json({ beneficiary: created }, 201)
})

// -------------------------------------------------------------------- users

directoryRoutes.get('/users', async (c) => {
  requireAdmin(c)
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.is_active, u.created_at,
            o.name AS organization_name
       FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
   ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 WHEN 'auditor' THEN 2 ELSE 3 END, u.name`,
  ).all()
  return c.json({ users: rows.results })
})

directoryRoutes.post('/users', async (c) => {
  const admin = requireAdmin(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const name = str(body.name, 'Name', { max: 120 })
  const email = str(body.email, 'Email', { max: 160 }).toLowerCase()
  const role = oneOf(body.role, ['admin', 'staff', 'auditor', 'donor'] as const, 'Role')
  const password = str(body.password, 'Password', { min: 8, max: 200 })
  if (!email.includes('@')) fail(400, 'VALIDATION', 'Enter a valid email address.')

  let organizationId: number | null = null
  if (role === 'staff') {
    organizationId = int(body.organization_id, 'Organization')
  } else if (body.organization_id) {
    organizationId = int(body.organization_id, 'Organization')
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) fail(409, 'DUPLICATE', 'A user with this email already exists.')

  const hash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, name, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(email, name, hash, role, organizationId)
    .run()

  await auditStatement(
    c.env.DB, admin, 'CREATE', 'user', Number(result.meta.last_row_id),
    `Created ${role} account for ${name}`,
    { email, role },
    clientIp(c),
  ).run()

  return c.json({ ok: true }, 201)
})

directoryRoutes.patch('/users/:id', async (c) => {
  const admin = requireAdmin(c)
  const id = int(c.req.param('id'), 'User')
  if (id === admin.id) fail(400, 'VALIDATION', 'You cannot change your own role or status.')

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const target = await c.env.DB.prepare('SELECT id, name, role, is_active FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: number; name: string; role: string; is_active: number }>()
  if (!target) fail(404, 'NOT_FOUND', 'User not found.')

  const role = body.role ? oneOf(body.role, ['admin', 'staff', 'auditor', 'donor'] as const, 'Role') : target.role
  const isActive = body.is_active === undefined ? target.is_active : body.is_active ? 1 : 0

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET role = ?, is_active = ? WHERE id = ?').bind(role, isActive, id),
    auditStatement(
      c.env.DB, admin, 'UPDATE', 'user', id,
      `Updated account ${target.name}: role ${target.role} → ${role}, ${isActive ? 'active' : 'disabled'}`,
      { previous_role: target.role, role, is_active: isActive },
      clientIp(c),
    ),
  ])

  if (!isActive) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default directoryRoutes
