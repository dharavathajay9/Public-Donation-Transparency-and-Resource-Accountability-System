import { Hono } from 'hono'
import { fail, pageParams, str } from '../lib'
import { requireAuditAccess, requireUser } from '../guards'
import type { AppEnv, SessionUser } from '../types'

const insightRoutes = new Hono<AppEnv>()

function scopeOf(user: SessionUser): number | null {
  if (user.role === 'staff') {
    if (!user.organization_id) fail(403, 'ORG_SCOPE', 'Your account is not linked to an organization.')
    return user.organization_id
  }
  return null
}

// ----------------------------------------------------------------- dashboard

insightRoutes.get('/dashboard', async (c) => {
  const user = requireUser(c)
  const db = c.env.DB

  if (user.role === 'donor') {
    const donorId = user.donor_id
    if (!donorId) fail(403, 'NO_DONOR_PROFILE', 'This account is not linked to a donor profile.')

    const [totals, donations, campaigns] = await Promise.all([
      db.prepare(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(CASE WHEN kind = 'monetary' THEN amount END), 0) AS given,
                COALESCE(SUM(CASE WHEN kind = 'material' THEN estimated_value END), 0) AS in_kind,
                COUNT(DISTINCT campaign_id) AS campaigns,
                MAX(donated_at) AS last_at
           FROM donations WHERE donor_id = ?`,
      )
        .bind(donorId)
        .first(),
      db.prepare(
        `SELECT d.receipt_no, d.kind, d.amount, d.item_name, d.quantity, d.estimated_value,
                d.donated_at, c.title AS campaign_title, c.id AS campaign_id,
                o.name AS organization_name
           FROM donations d JOIN campaigns c ON c.id = d.campaign_id
           JOIN organizations o ON o.id = c.organization_id
          WHERE d.donor_id = ? ORDER BY d.donated_at DESC LIMIT 10`,
      )
        .bind(donorId)
        .all(),
      db.prepare(
        `SELECT f.*, (f.raised * 1.0 / f.goal_amount) AS progress
           FROM v_campaign_finance f
          WHERE f.campaign_id IN (SELECT campaign_id FROM donations WHERE donor_id = ?)`,
      )
        .bind(donorId)
        .all(),
    ])

    return c.json({
      role: user.role,
      organization: null,
      kpis: totals ?? {},
      donations: donations.results,
      campaigns: campaigns.results,
      activity_kind: 'donations',
    })
  }

  const scope = scopeOf(user)
  const orgWhere = scope ? 'WHERE organization_id = ?' : ''
  const p = scope ? [scope] : []

  const [campaigns, beneficiaryRow, pendingRow, distributionRow, auditRow, monthly, categories, statuses] =
    await Promise.all([
      db.prepare(`SELECT *, (raised * 1.0 / goal_amount) AS progress FROM v_campaign_finance ${orgWhere} ORDER BY raised DESC`).bind(...p).all(),
      db.prepare(`SELECT COUNT(*) AS n FROM beneficiaries ${orgWhere}`).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM allocations a JOIN campaigns c ON c.id = a.campaign_id
          WHERE a.status <> 'distributed' ${scope ? 'AND c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(ds.amount), 0) AS value
           FROM distributions ds JOIN allocations a ON a.id = ds.allocation_id
           JOIN campaigns c ON c.id = a.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number; value: number }>(),
      db.prepare('SELECT COUNT(*) AS n FROM audit_logs').first<{ n: number }>(),
      db.prepare(
        `SELECT substr(d.donated_at, 1, 7) AS month,
                SUM(CASE WHEN d.kind = 'monetary' THEN d.amount ELSE 0 END) AS monetary,
                SUM(CASE WHEN d.kind = 'material' THEN d.estimated_value ELSE 0 END) AS material,
                COUNT(*) AS donations
           FROM donations d JOIN campaigns c ON c.id = d.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY substr(d.donated_at, 1, 7) ORDER BY month`,
      ).bind(...p).all(),
      db.prepare(
        `SELECT e.category, COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS entries
           FROM expenses e JOIN campaigns c ON c.id = e.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY e.category ORDER BY total DESC`,
      ).bind(...p).all(),
      db.prepare(
        `SELECT a.status, COUNT(*) AS n, COALESCE(SUM(a.amount), 0) AS amount
           FROM allocations a JOIN campaigns c ON c.id = a.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY a.status`,
      ).bind(...p).all(),
    ])

  const rows = campaigns.results as Array<Record<string, unknown>>
  const kpis: Record<string, number> = {
    raised: rows.reduce((sum, r) => sum + Number(r.raised ?? 0), 0),
    material_value: rows.reduce((sum, r) => sum + Number(r.material_value ?? 0), 0),
    allocated: rows.reduce((sum, r) => sum + Number(r.allocated ?? 0), 0),
    spent: rows.reduce((sum, r) => sum + Number(r.spent ?? 0), 0),
    campaigns: rows.length,
    active_campaigns: rows.filter((r) => String(r.status) === 'active').length,
    donations: rows.reduce((sum, r) => sum + Number(r.donation_count ?? 0), 0),
    beneficiaries: beneficiaryRow?.n ?? 0,
    pending_allocations: pendingRow?.n ?? 0,
    distributions: distributionRow?.n ?? 0,
    distributed_value: distributionRow?.value ?? 0,
    audit_entries: auditRow?.n ?? 0,
    expense_entries: (categories.results as Array<{ entries: number }>).reduce((s, r) => s + r.entries, 0),
  }
  kpis.available = kpis.raised - kpis.allocated
  kpis.balance = kpis.raised - kpis.spent

  let activity: unknown[] = []
  let activityKind = 'audit'
  if (user.role === 'staff') {
    activityKind = 'donations'
    const recent = await db.prepare(
      `SELECT d.receipt_no, d.kind, d.amount, d.item_name, d.quantity, d.estimated_value,
              d.donated_at, dn.name AS donor_name, c.title AS campaign_title
         FROM donations d JOIN donors dn ON dn.id = d.donor_id
         JOIN campaigns c ON c.id = d.campaign_id
        WHERE c.organization_id = ? ORDER BY d.donated_at DESC LIMIT 8`,
    )
      .bind(scope)
      .all()
    activity = recent.results
  } else {
    const recent = await db.prepare(
      `SELECT id, action, entity, entity_id, summary, actor_name, actor_role, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT 8`,
    ).all()
    activity = recent.results
  }

  return c.json({
    role: user.role,
    organization: user.organization_name,
    scope_label: scope ? user.organization_name : 'All organizations',
    kpis,
    monthly: monthly.results,
    expense_categories: categories.results,
    allocation_status: statuses.results,
    campaigns: campaigns.results,
    activity,
    activity_kind: activityKind,
  })
})

// ------------------------------------------------------------------- reports

insightRoutes.get('/reports', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Reports are not available to donor accounts.')
  const scope = scopeOf(user)
  const db = c.env.DB
  const p = scope ? [scope] : []

  const [campaigns, organizations, expenseCategories, monthly, donors, beneficiaries] =
    await Promise.all([
      db.prepare(
        `SELECT *, (raised * 1.0 / goal_amount) AS progress,
                (raised - allocated) AS unallocated, (raised - spent) AS balance
           FROM v_campaign_finance ${scope ? 'WHERE organization_id = ?' : ''}
       ORDER BY raised DESC`,
      ).bind(...p).all(),
      db.prepare('SELECT * FROM v_organization_summary ORDER BY raised DESC').all(),
      db.prepare(
        `SELECT e.category, COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS entries
           FROM expenses e JOIN campaigns c ON c.id = e.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY e.category ORDER BY total DESC`,
      ).bind(...p).all(),
      db.prepare(
        `SELECT substr(d.donated_at, 1, 7) AS month,
                SUM(CASE WHEN d.kind = 'monetary' THEN d.amount ELSE 0 END) AS monetary,
                SUM(CASE WHEN d.kind = 'material' THEN d.estimated_value ELSE 0 END) AS material,
                COUNT(*) AS donations
           FROM donations d JOIN campaigns c ON c.id = d.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY substr(d.donated_at, 1, 7) ORDER BY month`,
      ).bind(...p).all(),
      db.prepare(
        `SELECT dn.name, dn.donor_type, dn.city, COUNT(d.id) AS donation_count,
                COALESCE(SUM(CASE WHEN d.kind = 'monetary' THEN d.amount END), 0) AS monetary_total,
                COALESCE(SUM(CASE WHEN d.kind = 'material' THEN d.estimated_value END), 0) AS material_total
           FROM donors dn JOIN donations d ON d.donor_id = dn.id
           JOIN campaigns c ON c.id = d.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}
       GROUP BY dn.id ORDER BY (monetary_total + material_total) DESC LIMIT 12`,
      ).bind(...p).all(),
      db.prepare(
        `SELECT * FROM v_beneficiary_support ${scope ? 'WHERE organization_id = ?' : ''}
       ORDER BY funds_received DESC LIMIT 10`,
      ).bind(...p).all(),
    ])

  const rows = campaigns.results as Array<Record<string, unknown>>
  const totals = {
    raised: rows.reduce((s, r) => s + Number(r.raised ?? 0), 0),
    material_value: rows.reduce((s, r) => s + Number(r.material_value ?? 0), 0),
    allocated: rows.reduce((s, r) => s + Number(r.allocated ?? 0), 0),
    spent: rows.reduce((s, r) => s + Number(r.spent ?? 0), 0),
    donations: rows.reduce((s, r) => s + Number(r.donation_count ?? 0), 0),
  }

  const [fundGuard, expenseGuard, distributionGuard, receiptRow, donationRow, auditDonationRow] =
    await Promise.all([
      db.prepare(
        `SELECT COUNT(*) AS n FROM campaigns c
          WHERE (SELECT COALESCE(SUM(amount), 0) FROM allocations WHERE campaign_id = c.id AND kind = 'fund')
              > (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE campaign_id = c.id AND kind = 'monetary')
            ${scope ? 'AND c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM campaigns c
          WHERE (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE campaign_id = c.id)
              > (SELECT COALESCE(SUM(amount), 0) FROM allocations WHERE campaign_id = c.id AND kind = 'fund')
            ${scope ? 'AND c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM allocations a JOIN campaigns c ON c.id = a.campaign_id
          WHERE (CASE WHEN a.kind = 'fund'
                      THEN (SELECT COALESCE(SUM(amount), 0) FROM distributions WHERE allocation_id = a.id)
                      ELSE (SELECT COALESCE(SUM(quantity), 0) FROM distributions WHERE allocation_id = a.id)
                 END)
              > (CASE WHEN a.kind = 'fund' THEN a.amount ELSE a.quantity END)
            ${scope ? 'AND c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM expenses e JOIN campaigns c ON c.id = e.campaign_id
          WHERE e.receipt_ref IS NULL ${scope ? 'AND c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM donations d JOIN campaigns c ON c.id = d.campaign_id
          ${scope ? 'WHERE c.organization_id = ?' : ''}`,
      ).bind(...p).first<{ n: number }>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'DONATION'`,
      ).first<{ n: number }>(),
    ])

  const integrity = [
    {
      key: 'allocations',
      label: 'Allocations stay within received funds',
      passed: (fundGuard?.n ?? 0) === 0,
      detail: `${fundGuard?.n ?? 0} campaign(s) with over-allocation`,
    },
    {
      key: 'expenses',
      label: 'Expenses stay within allocated funds',
      passed: (expenseGuard?.n ?? 0) === 0,
      detail: `${expenseGuard?.n ?? 0} campaign(s) with excess expenditure`,
    },
    {
      key: 'distributions',
      label: 'Distributions stay within allocations',
      passed: (distributionGuard?.n ?? 0) === 0,
      detail: `${distributionGuard?.n ?? 0} allocation(s) over-distributed`,
    },
    {
      key: 'receipts',
      label: 'Every expense carries a receipt reference',
      passed: (receiptRow?.n ?? 0) === 0,
      detail: `${receiptRow?.n ?? 0} expense(s) missing a receipt`,
    },
    {
      key: 'audit',
      label: 'Every donation has an audit entry',
      passed: (auditDonationRow?.n ?? 0) >= (donationRow?.n ?? 0),
      detail: `${auditDonationRow?.n ?? 0} audit entries for ${donationRow?.n ?? 0} donations`,
    },
  ]

  return c.json({
    generated_at: new Date().toISOString(),
    totals,
    campaigns: campaigns.results,
    organizations: organizations.results,
    expense_categories: expenseCategories.results,
    monthly: monthly.results,
    donors: donors.results,
    beneficiaries: beneficiaries.results,
    integrity,
  })
})

// --------------------------------------------------------------- audit trail

insightRoutes.get('/audit', async (c) => {
  requireAuditAccess(c)
  const { page, perPage, offset } = pageParams(c)

  const clauses: string[] = []
  const params: unknown[] = []
  const action = c.req.query('action')
  if (action && action !== 'all') {
    clauses.push('action = ?')
    params.push(action)
  }
  const entity = c.req.query('entity')
  if (entity && entity !== 'all') {
    clauses.push('entity = ?')
    params.push(entity)
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(summary LIKE ? OR actor_name LIKE ? OR CAST(entity_id AS TEXT) = ?)')
    params.push(`%${q}%`, `%${q}%`, q)
  }
  const from = c.req.query('from')
  if (from) {
    clauses.push('created_at >= ?')
    params.push(from)
  }
  const to = c.req.query('to')
  if (to) {
    clauses.push('created_at <= ?')
    params.push(`${to}T23:59:59Z`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const [rows, total, actions] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip, created_at
         FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${where}`)
      .bind(...params)
      .first<{ n: number }>(),
    c.env.DB.prepare('SELECT action, COUNT(*) AS n FROM audit_logs GROUP BY action ORDER BY n DESC').all(),
  ])

  return c.json({
    entries: rows.results,
    total: total?.n ?? 0,
    actions: actions.results,
    page,
    per_page: perPage,
  })
})

// ------------------------------------------------------------- CSV downloads

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

insightRoutes.get('/export', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Exports are not available to donor accounts.')
  const type = str(c.req.query('type') ?? 'donations', 'Export type', { max: 30 })
  const scope = scopeOf(user)
  const db = c.env.DB
  let headers: string[] = []
  let rows: Array<Array<unknown>> = []
  let filename = 'trustledger-export.csv'

  if (type === 'donations') {
    const result = await db.prepare(
      `SELECT d.receipt_no, d.kind, d.amount, d.item_name, d.quantity, d.estimated_value,
              d.channel, d.donated_at, dn.name AS donor_name, dn.donor_type,
              c.code AS campaign_code, c.title AS campaign_title, o.name AS organization_name
         FROM donations d JOIN donors dn ON dn.id = d.donor_id
         JOIN campaigns c ON c.id = d.campaign_id JOIN organizations o ON o.id = c.organization_id
        ${scope ? 'WHERE c.organization_id = ?' : ''} ORDER BY d.donated_at DESC`,
    ).bind(...(scope ? [scope] : [])).all<Record<string, unknown>>()
    headers = ['Receipt', 'Type', 'Amount', 'Item', 'Quantity', 'Estimated value', 'Channel', 'Date', 'Donor', 'Donor type', 'Campaign code', 'Campaign', 'Organization']
    rows = result.results.map((r) => [r.receipt_no, r.kind, r.amount, r.item_name, r.quantity, r.estimated_value, r.channel, r.donated_at, r.donor_name, r.donor_type, r.campaign_code, r.campaign_title, r.organization_name])
    filename = 'trustledger-donations.csv'
  } else if (type === 'expenses') {
    const result = await db.prepare(
      `SELECT e.voucher_no, e.category, e.description, e.amount, e.vendor, e.receipt_ref,
              e.spent_at, c.title AS campaign_title, o.name AS organization_name
         FROM expenses e JOIN campaigns c ON c.id = e.campaign_id
         JOIN organizations o ON o.id = c.organization_id
        ${scope ? 'WHERE c.organization_id = ?' : ''} ORDER BY e.spent_at DESC`,
    ).bind(...(scope ? [scope] : [])).all<Record<string, unknown>>()
    headers = ['Voucher', 'Category', 'Description', 'Amount', 'Vendor', 'Receipt', 'Date', 'Campaign', 'Organization']
    rows = result.results.map((r) => [r.voucher_no, r.category, r.description, r.amount, r.vendor, r.receipt_ref, r.spent_at, r.campaign_title, r.organization_name])
    filename = 'trustledger-expenses.csv'
  } else if (type === 'allocations') {
    const result = await db.prepare(
      `SELECT reference, campaign_title, beneficiary_name, kind, amount, item_name, quantity,
              status, purpose, allocated_at
         FROM v_allocation_detail ${scope ? 'WHERE organization_id = ?' : ''} ORDER BY allocated_at DESC`,
    ).bind(...(scope ? [scope] : [])).all<Record<string, unknown>>()
    headers = ['Reference', 'Campaign', 'Beneficiary', 'Type', 'Amount', 'Item', 'Quantity', 'Status', 'Purpose', 'Allocated at']
    rows = result.results.map((r) => [r.reference, r.campaign_title, r.beneficiary_name, r.kind, r.amount, r.item_name, r.quantity, r.status, r.purpose, r.allocated_at])
    filename = 'trustledger-allocations.csv'
  } else {
    fail(400, 'VALIDATION', 'Unknown export type.')
  }

  const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  })
})

export default insightRoutes
