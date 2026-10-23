import { Hono } from 'hono'
import { fail, int, isoDate, num, oneOf, pageParams, reference, str } from '../lib'
import { clientIp, ensureOrgAccess, requireUser, requireWriter } from '../guards'
import type { AppEnv } from '../types'

const ledgerRoutes = new Hono<AppEnv>()

const CHANNELS = ['online', 'bank_transfer', 'upi', 'cheque', 'cash', 'in_kind'] as const
const EXPENSE_CATEGORIES = [
  'logistics', 'procurement', 'medical', 'education',
  'field_operations', 'utilities', 'admin', 'other',
] as const

// ---------------------------------------------------------------- donations

ledgerRoutes.get('/donations', async (c) => {
  const user = requireUser(c)
  const { page, perPage, offset } = pageParams(c)
  const clauses: string[] = []
  const params: unknown[] = []

  if (user.role === 'staff') {
    clauses.push('c.organization_id = ?')
    params.push(user.organization_id)
  }
  if (user.role === 'donor') {
    clauses.push('d.donor_id = ?')
    params.push(user.donor_id ?? -1)
  }
  const kind = c.req.query('kind')
  if (kind && kind !== 'all') {
    clauses.push('d.kind = ?')
    params.push(kind)
  }
  const campaignId = c.req.query('campaign_id')
  if (campaignId && campaignId !== 'all') {
    clauses.push('d.campaign_id = ?')
    params.push(Number(campaignId))
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(d.receipt_no LIKE ? OR dn.name LIKE ? OR c.title LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const from = c.req.query('from')
  if (from) {
    clauses.push('d.donated_at >= ?')
    params.push(from)
  }
  const to = c.req.query('to')
  if (to) {
    clauses.push('d.donated_at <= ?')
    params.push(`${to}T23:59:59Z`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const base = `FROM donations d
    JOIN donors dn ON dn.id = d.donor_id
    JOIN campaigns c ON c.id = d.campaign_id
    JOIN organizations o ON o.id = c.organization_id ${where}`

  const [rows, totals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT d.id, d.receipt_no, d.kind, d.amount, d.item_name, d.unit, d.quantity,
              d.estimated_value, d.channel, d.donated_at, d.notes, d.donor_id,
              dn.name AS donor_name, dn.donor_type, dn.city AS donor_city,
              c.id AS campaign_id, c.title AS campaign_title, c.code AS campaign_code,
              o.name AS organization_name
       ${base} ORDER BY d.donated_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN d.kind = 'monetary' THEN d.amount END), 0) AS monetary,
              COALESCE(SUM(CASE WHEN d.kind = 'material' THEN d.estimated_value END), 0) AS material
       ${base}`,
    )
      .bind(...params)
      .first<{ count: number; monetary: number; material: number }>(),
  ])

  return c.json({
    donations: rows.results,
    total: totals?.count ?? 0,
    totals: { monetary: totals?.monetary ?? 0, material: totals?.material ?? 0 },
    page,
    per_page: perPage,
  })
})

ledgerRoutes.post('/donations', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const campaignId = int(body.campaign_id, 'Campaign')
  const campaign = await c.env.DB.prepare(
    'SELECT id, title, code, status, organization_id FROM campaigns WHERE id = ?',
  )
    .bind(campaignId)
    .first<{ id: number; title: string; code: string; status: string; organization_id: number }>()

  if (!campaign) fail(404, 'NOT_FOUND', 'Campaign not found.')
  ensureOrgAccess(user, campaign.organization_id)
  if (campaign.status !== 'active') {
    fail(409, 'CAMPAIGN_NOT_ACCEPTING_DONATIONS', 'Only active campaigns can accept new donations.')
  }

  const kind = oneOf(body.kind, ['monetary', 'material'] as const, 'Donation type')
  const donatedAt = isoDate(body.donated_at, 'Donation date')
  const notes = str(body.notes, 'Notes', { required: false, max: 500 })

  let donorId = 0
  let donorName = ''
  if (body.donor_id) {
    donorId = int(body.donor_id, 'Donor')
    const donor = await c.env.DB.prepare('SELECT id, name FROM donors WHERE id = ?')
      .bind(donorId)
      .first<{ id: number; name: string }>()
    if (!donor) fail(404, 'NOT_FOUND', 'Donor not found.')
    donorName = donor.name
  } else {
    donorName = str(body.donor_name, 'Donor name', { max: 120 })
    const donorType = oneOf(body.donor_type ?? 'individual', ['individual', 'corporate', 'trust', 'anonymous'] as const, 'Donor type')
    const email = str(body.donor_email, 'Donor email', { required: false, max: 160 })
    const phone = str(body.donor_phone, 'Donor phone', { required: false, max: 30 })
    const city = str(body.donor_city, 'Donor city', { required: false, max: 80 })
    const result = await c.env.DB.prepare(
      'INSERT INTO donors (name, email, phone, donor_type, city) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(donorName, email || null, phone || null, donorType, city || null)
      .run()
    donorId = Number(result.meta.last_row_id)
  }

  let amount = 0
  let itemName: string | null = null
  let unit: string | null = null
  let quantity = 0
  let estimatedValue = 0
  let channel: string

  if (kind === 'monetary') {
    amount = num(body.amount, 'Amount', { min: 1 })
    channel = oneOf(body.channel ?? 'online', CHANNELS, 'Channel')
    if (channel === 'in_kind') fail(400, 'VALIDATION', 'Choose a payment channel for monetary donations.')
  } else {
    itemName = str(body.item_name, 'Item name', { max: 120 })
    unit = str(body.unit, 'Unit', { required: false, max: 30 }) || 'unit'
    quantity = num(body.quantity, 'Quantity', { min: 0.01 })
    estimatedValue = num(body.estimated_value ?? 0, 'Estimated value', { required: false })
    channel = 'in_kind'
  }

  const receiptNo = reference('TL-D')
  const summary =
    kind === 'monetary'
      ? `Recorded ₹${amount.toLocaleString('en-IN')} from ${donorName} for ${campaign.title}`
      : `Recorded ${quantity} ${unit} of ${itemName} from ${donorName} for ${campaign.title}`

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO donations (receipt_no, donor_id, campaign_id, kind, amount, item_name, unit,
                              quantity, estimated_value, channel, donated_at, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      receiptNo, donorId, campaignId, kind, amount, itemName, unit,
      quantity, estimatedValue, channel, donatedAt, notes || null, user.id,
    ),
    c.env.DB.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip)
       SELECT ?, ?, ?, 'DONATION', 'donation', id, ?, ?, ? FROM donations WHERE receipt_no = ?`,
    ).bind(
      user.id, user.name, user.role, summary,
      JSON.stringify({ receipt: receiptNo, campaign: campaign.code, kind, amount, quantity }),
      clientIp(c), receiptNo,
    ),
  ])

  const created = await c.env.DB.prepare(
    `SELECT d.*, dn.name AS donor_name, c.title AS campaign_title, c.code AS campaign_code
       FROM donations d JOIN donors dn ON dn.id = d.donor_id
       JOIN campaigns c ON c.id = d.campaign_id WHERE d.receipt_no = ?`,
  )
    .bind(receiptNo)
    .first()

  return c.json({ donation: created }, 201)
})

// -------------------------------------------------------------- allocations

ledgerRoutes.get('/allocations', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Allocations are not visible to donor accounts.')

  const { page, perPage, offset } = pageParams(c)
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
  const kind = c.req.query('kind')
  if (kind && kind !== 'all') {
    clauses.push('kind = ?')
    params.push(kind)
  }
  const campaignId = c.req.query('campaign_id')
  if (campaignId && campaignId !== 'all') {
    clauses.push('campaign_id = ?')
    params.push(Number(campaignId))
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(beneficiary_name LIKE ? OR campaign_title LIKE ? OR reference LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const [rows, totals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM v_allocation_detail ${where} ORDER BY allocated_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN kind = 'fund' THEN amount END), 0) AS funds,
              SUM(CASE WHEN status <> 'distributed' THEN 1 ELSE 0 END) AS pending
         FROM allocations ${where}`,
    )
      .bind(...params)
      .first<{ count: number; funds: number; pending: number }>(),
  ])

  return c.json({
    allocations: rows.results,
    total: totals?.count ?? 0,
    totals: { funds: totals?.funds ?? 0, pending: totals?.pending ?? 0 },
    page,
    per_page: perPage,
  })
})

ledgerRoutes.post('/allocations', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const campaignId = int(body.campaign_id, 'Campaign')
  const beneficiaryId = int(body.beneficiary_id, 'Beneficiary')
  const campaign = await c.env.DB.prepare(
    'SELECT id, title, organization_id FROM campaigns WHERE id = ?',
  )
    .bind(campaignId)
    .first<{ id: number; title: string; organization_id: number }>()
  if (!campaign) fail(404, 'NOT_FOUND', 'Campaign not found.')
  ensureOrgAccess(user, campaign.organization_id)

  const beneficiary = await c.env.DB.prepare(
    'SELECT id, name, organization_id FROM beneficiaries WHERE id = ?',
  )
    .bind(beneficiaryId)
    .first<{ id: number; name: string; organization_id: number }>()
  if (!beneficiary) fail(404, 'NOT_FOUND', 'Beneficiary not found.')
  if (beneficiary.organization_id !== campaign.organization_id) {
    fail(409, 'ORGANIZATION_MISMATCH', 'The beneficiary belongs to a different organization than the campaign.')
  }

  const kind = oneOf(body.kind, ['fund', 'material'] as const, 'Allocation type')
  const purpose = str(body.purpose, 'Purpose', { max: 200 })
  const allocatedAt = isoDate(body.allocated_at, 'Allocation date')
  const amount = kind === 'fund' ? num(body.amount, 'Amount', { min: 1 }) : 0
  const quantity = kind === 'material' ? num(body.quantity, 'Quantity', { min: 0.01 }) : 0
  const itemName = kind === 'material' ? str(body.item_name, 'Item name', { max: 120 }) : null
  const unit = kind === 'material' ? str(body.unit, 'Unit', { required: false, max: 30 }) || 'unit' : null
  const ref = reference('ALC')

  const summary =
    kind === 'fund'
      ? `Allocated ₹${amount.toLocaleString('en-IN')} to ${beneficiary.name} from ${campaign.title}`
      : `Allocated ${quantity} ${unit} of ${itemName} to ${beneficiary.name} from ${campaign.title}`

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO allocations (reference, campaign_id, beneficiary_id, kind, amount, item_name,
                                unit, quantity, purpose, allocated_at, allocated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(ref, campaignId, beneficiaryId, kind, amount, itemName, unit, quantity, purpose, allocatedAt, user.id),
    c.env.DB.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip)
       SELECT ?, ?, ?, 'ALLOCATE', 'allocation', id, ?, ?, ? FROM allocations WHERE reference = ?`,
    ).bind(
      user.id, user.name, user.role, summary,
      JSON.stringify({ reference: ref, campaign: campaign.title, kind, amount, quantity }),
      clientIp(c), ref,
    ),
  ])

  const created = await c.env.DB.prepare('SELECT * FROM v_allocation_detail WHERE reference = ?')
    .bind(ref)
    .first()
  return c.json({ allocation: created }, 201)
})

// ------------------------------------------------------------ distributions

ledgerRoutes.get('/distributions', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Distributions are not visible to donor accounts.')

  const { page, perPage, offset } = pageParams(c)
  const clauses: string[] = []
  const params: unknown[] = []
  if (user.role === 'staff') {
    clauses.push('c.organization_id = ?')
    params.push(user.organization_id)
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(b.name LIKE ? OR ds.reference LIKE ? OR c.title LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const allocationId = c.req.query('allocation_id')
  if (allocationId) {
    clauses.push('ds.allocation_id = ?')
    params.push(Number(allocationId))
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const [rows, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT ds.id, ds.reference, ds.allocation_id, ds.amount, ds.quantity, ds.evidence_ref,
              ds.notes, ds.distributed_at, b.name AS beneficiary_name, b.location,
              a.reference AS allocation_reference, a.kind AS allocation_kind, a.item_name,
              c.title AS campaign_title
         FROM distributions ds
         JOIN allocations a ON a.id = ds.allocation_id
         JOIN beneficiaries b ON b.id = ds.beneficiary_id
         JOIN campaigns c ON c.id = a.campaign_id
         ${where} ORDER BY ds.distributed_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM distributions ds
         JOIN allocations a ON a.id = ds.allocation_id
         JOIN beneficiaries b ON b.id = ds.beneficiary_id
         JOIN campaigns c ON c.id = a.campaign_id ${where}`,
    )
      .bind(...params)
      .first<{ n: number }>(),
  ])

  return c.json({
    distributions: rows.results,
    total: total?.n ?? 0,
    page,
    per_page: perPage,
  })
})

ledgerRoutes.post('/distributions', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const allocationId = int(body.allocation_id, 'Allocation')
  const allocation = await c.env.DB.prepare(
    `SELECT a.id, a.reference, a.kind, a.amount, a.quantity, a.item_name, a.unit,
            a.beneficiary_id, a.campaign_id, c.organization_id, c.title AS campaign_title,
            b.name AS beneficiary_name
       FROM allocations a
       JOIN campaigns c ON c.id = a.campaign_id
       JOIN beneficiaries b ON b.id = a.beneficiary_id
      WHERE a.id = ?`,
  )
    .bind(allocationId)
    .first<{
      id: number; reference: string; kind: 'fund' | 'material'; amount: number; quantity: number
      item_name: string | null; unit: string | null; beneficiary_id: number; campaign_id: number
      organization_id: number; campaign_title: string; beneficiary_name: string
    }>()
  if (!allocation) fail(404, 'NOT_FOUND', 'Allocation not found.')
  ensureOrgAccess(user, allocation.organization_id)

  const amount = allocation.kind === 'fund'
    ? num(body.amount, 'Amount', { min: 1 })
    : 0
  const quantity = allocation.kind === 'material'
    ? num(body.quantity, 'Quantity', { min: 0.01 })
    : 0
  const evidence = str(body.evidence_ref, 'Evidence reference', { required: false, max: 80 })
  const notes = str(body.notes, 'Notes', { required: false, max: 400 })
  const distributedAt = isoDate(body.distributed_at, 'Distribution date')
  const ref = reference('DST')

  const summary =
    allocation.kind === 'fund'
      ? `Distributed ₹${amount.toLocaleString('en-IN')} to ${allocation.beneficiary_name}`
      : `Distributed ${quantity} ${allocation.unit ?? 'unit'} of ${allocation.item_name} to ${allocation.beneficiary_name}`

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO distributions (reference, allocation_id, beneficiary_id, amount, quantity,
                                  evidence_ref, notes, distributed_at, distributed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ref, allocationId, allocation.beneficiary_id, amount, quantity,
      evidence || null, notes, distributedAt, user.id,
    ),
    c.env.DB.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip)
       SELECT ?, ?, ?, 'DISTRIBUTE', 'distribution', id, ?, ?, ? FROM distributions WHERE reference = ?`,
    ).bind(
      user.id, user.name, user.role, summary,
      JSON.stringify({
        reference: ref, allocation: allocation.reference,
        kind: allocation.kind, amount, quantity,
      }),
      clientIp(c), ref,
    ),
  ])

  const [distribution, updated] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM distributions WHERE reference = ?').bind(ref).first(),
    c.env.DB.prepare('SELECT * FROM v_allocation_detail WHERE id = ?').bind(allocationId).first(),
  ])

  return c.json({ distribution, allocation: updated }, 201)
})

// ----------------------------------------------------------------- expenses

ledgerRoutes.get('/expenses', async (c) => {
  const user = requireUser(c)
  if (user.role === 'donor') fail(403, 'FORBIDDEN', 'Expenses are not visible to donor accounts.')

  const { page, perPage, offset } = pageParams(c)
  const clauses: string[] = []
  const params: unknown[] = []
  if (user.role === 'staff') {
    clauses.push('c.organization_id = ?')
    params.push(user.organization_id)
  }
  const category = c.req.query('category')
  if (category && category !== 'all') {
    clauses.push('e.category = ?')
    params.push(category)
  }
  const campaignId = c.req.query('campaign_id')
  if (campaignId && campaignId !== 'all') {
    clauses.push('e.campaign_id = ?')
    params.push(Number(campaignId))
  }
  const q = c.req.query('q')?.trim()
  if (q) {
    clauses.push('(e.description LIKE ? OR e.vendor LIKE ? OR c.title LIKE ? OR e.voucher_no LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const [rows, totals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT e.*, c.title AS campaign_title, c.code AS campaign_code, o.name AS organization_name
         FROM expenses e
         JOIN campaigns c ON c.id = e.campaign_id
         JOIN organizations o ON o.id = c.organization_id
         ${where} ORDER BY e.spent_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, perPage, offset)
      .all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS total
         FROM expenses e JOIN campaigns c ON c.id = e.campaign_id ${where}`,
    )
      .bind(...params)
      .first<{ count: number; total: number }>(),
  ])

  return c.json({
    expenses: rows.results,
    total: totals?.count ?? 0,
    totals: { amount: totals?.total ?? 0 },
    page,
    per_page: perPage,
  })
})

ledgerRoutes.post('/expenses', async (c) => {
  const user = requireWriter(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

  const campaignId = int(body.campaign_id, 'Campaign')
  const campaign = await c.env.DB.prepare(
    'SELECT id, title, organization_id FROM campaigns WHERE id = ?',
  )
    .bind(campaignId)
    .first<{ id: number; title: string; organization_id: number }>()
  if (!campaign) fail(404, 'NOT_FOUND', 'Campaign not found.')
  ensureOrgAccess(user, campaign.organization_id)

  const category = oneOf(body.category, EXPENSE_CATEGORIES, 'Expense category')
  const description = str(body.description, 'Description', { max: 200 })
  const amount = num(body.amount, 'Amount', { min: 1 })
  const vendor = str(body.vendor, 'Vendor', { required: false, max: 120 })
  const receiptRef = str(body.receipt_ref, 'Receipt reference', { required: false, max: 80 })
  const spentAt = isoDate(body.spent_at, 'Expense date')
  const voucherNo = reference('EXP')

  let allocationId: number | null = null
  if (body.allocation_id) {
    const allocation = await c.env.DB.prepare(
      'SELECT id, campaign_id FROM allocations WHERE id = ?',
    )
      .bind(Number(body.allocation_id))
      .first<{ id: number; campaign_id: number }>()
    if (!allocation || allocation.campaign_id !== campaignId) {
      fail(400, 'VALIDATION', 'The selected allocation does not belong to this campaign.')
    }
    allocationId = allocation.id
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO expenses (voucher_no, campaign_id, allocation_id, category, description,
                             amount, vendor, receipt_ref, spent_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      voucherNo, campaignId, allocationId, category, description,
      amount, vendor || null, receiptRef || null, spentAt, user.id,
    ),
    c.env.DB.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, ip)
       SELECT ?, ?, ?, 'EXPENSE', 'expense', id, ?, ?, ? FROM expenses WHERE voucher_no = ?`,
    ).bind(
      user.id, user.name, user.role,
      `Recorded ₹${amount.toLocaleString('en-IN')} ${category.replace(/_/g, ' ')} expense for ${campaign.title}`,
      JSON.stringify({ voucher: voucherNo, campaign: campaign.title, category, amount }),
      clientIp(c), voucherNo,
    ),
  ])

  const created = await c.env.DB.prepare('SELECT * FROM expenses WHERE voucher_no = ?')
    .bind(voucherNo)
    .first()
  return c.json({ expense: created }, 201)
})

export default ledgerRoutes
