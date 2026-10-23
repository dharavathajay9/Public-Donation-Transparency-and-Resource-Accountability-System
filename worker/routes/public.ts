import { Hono } from 'hono'
import { fail, pageParams } from '../lib'
import type { AppEnv } from '../types'

const publicRoutes = new Hono<AppEnv>()

/** Platform-wide transparency counters for the landing page. */
publicRoutes.get('/stats', async (c) => {
  const db = c.env.DB
  const [stats, organizations, activity] = await Promise.all([
    db.prepare('SELECT * FROM v_platform_stats').first(),
    db.prepare('SELECT * FROM v_organization_summary ORDER BY raised DESC').all(),
    db
      .prepare(
        `SELECT id, action, entity, summary, created_at, actor_name, actor_role
           FROM audit_logs
          WHERE action IN ('DONATION', 'ALLOCATE', 'EXPENSE', 'DISTRIBUTE', 'STATUS')
          ORDER BY created_at DESC LIMIT 6`,
      )
      .all(),
  ])
  return c.json({
    stats: stats ?? {},
    organizations: organizations.results,
    recent_activity: activity.results,
  })
})

/** Public campaign directory — drafts stay private. */
publicRoutes.get('/campaigns', async (c) => {
  const category = c.req.query('category')
  const q = c.req.query('q')?.trim()
  const sort = c.req.query('sort') ?? 'progress'

  const clauses = ["status <> 'draft'"]
  const params: unknown[] = []
  if (category && category !== 'all') {
    clauses.push('category = ?')
    params.push(category)
  }
  if (q) {
    clauses.push('(title LIKE ? OR organization_name LIKE ? OR code LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const order =
    sort === 'raised'
      ? 'raised DESC'
      : sort === 'recent'
        ? 'start_date DESC'
        : 'CASE WHEN status = \'active\' THEN 0 ELSE 1 END, (raised * 1.0 / goal_amount) DESC'

  const rows = await c.env.DB.prepare(
    `SELECT *, (raised * 1.0 / goal_amount) AS progress
       FROM v_campaign_finance
      WHERE ${clauses.join(' AND ')}
   ORDER BY ${order}`,
  )
    .bind(...params)
    .all()

  return c.json({ campaigns: rows.results })
})

/** Public campaign page: the full money trail behind one campaign. */
publicRoutes.get('/campaigns/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) fail(400, 'VALIDATION', 'Invalid campaign id.')

  const campaign = await c.env.DB.prepare(
    `SELECT f.*, (f.raised * 1.0 / f.goal_amount) AS progress,
            o.mission AS organization_mission, o.verified AS organization_verified,
            o.website AS organization_website, o.registration_no AS organization_registration,
            c.description, c.summary, c.goal_reached_at
       FROM v_campaign_finance f
       JOIN campaigns c ON c.id = f.campaign_id
       JOIN organizations o ON o.id = f.organization_id
      WHERE f.campaign_id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!campaign || campaign.status === 'draft') {
    fail(404, 'NOT_FOUND', 'Campaign not found.')
  }

  const [expenses, donations, distributions, monthly] = await Promise.all([
    c.env.DB.prepare(
      `SELECT category, COUNT(*) AS entries, COALESCE(SUM(amount), 0) AS total
         FROM expenses WHERE campaign_id = ?
        GROUP BY category ORDER BY total DESC`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare(
      `SELECT d.receipt_no, d.kind, d.amount, d.item_name, d.quantity, d.estimated_value,
              d.channel, d.donated_at, dn.name AS donor_name, dn.donor_type
         FROM donations d JOIN donors dn ON dn.id = d.donor_id
        WHERE d.campaign_id = ?
     ORDER BY d.donated_at DESC LIMIT 15`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare(
      `SELECT ds.reference, ds.amount, ds.quantity, ds.distributed_at, ds.evidence_ref,
              b.name AS beneficiary_name, b.location, a.kind, a.item_name
         FROM distributions ds
         JOIN allocations a ON a.id = ds.allocation_id
         JOIN beneficiaries b ON b.id = ds.beneficiary_id
        WHERE a.campaign_id = ?
     ORDER BY ds.distributed_at DESC LIMIT 12`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare(
      `SELECT substr(donated_at, 1, 7) AS month,
              SUM(CASE WHEN kind = 'monetary' THEN amount ELSE 0 END) AS monetary
         FROM donations WHERE campaign_id = ?
     GROUP BY substr(donated_at, 1, 7) ORDER BY month`,
    )
      .bind(id)
      .all(),
  ])

  return c.json({
    campaign,
    expenses: expenses.results,
    donations: donations.results,
    distributions: distributions.results,
    monthly: monthly.results,
  })
})

/** Public accountability log — every recorded money movement, newest first. */
publicRoutes.get('/ledger', async (c) => {
  const { page, perPage, offset } = pageParams(c)
  const filter = c.req.query('entity')
  const clauses = [
    "action IN ('DONATION', 'ALLOCATE', 'EXPENSE', 'DISTRIBUTE', 'STATUS', 'CREATE', 'AUDIT')",
  ]
  const params: unknown[] = []
  if (filter && filter !== 'all') {
    clauses.push('entity = ?')
    params.push(filter)
  }
  const where = clauses.join(' AND ')

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, action, entity, entity_id, summary, meta, actor_name, actor_role, created_at
         FROM audit_logs WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>(),
  ])

  return c.json({ entries: rows.results, total: total?.n ?? 0, page, per_page: perPage })
})

export default publicRoutes
