import { hashPassword } from './auth'

/**
 * Deterministic demo dataset. Realistic Indian NGO campaigns with a full
 * donation → allocation → expense → distribution chain, plus audit history.
 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_TIME = new Date('2026-10-20T10:30:00Z').getTime()

interface CampaignSeed {
  id: number
  org: number
  code: string
  title: string
  category: string
  goal: number
  start: string
  end: string
  factor: number
  status: 'active' | 'completed'
  summary: string
  description: string
  items: Array<[string, string, number]>
}

export async function seedDatabase(db: D1Database): Promise<void> {
  const rnd = mulberry32(20261023)
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
  const round50 = (n: number) => Math.max(500, Math.round(n / 50) * 50)
  const daysAgo = (days: number, hour = int(8, 19)) =>
    new Date(BASE_TIME - days * 86_400_000 + hour * 3_600_000).toISOString()

  const statements: D1PreparedStatement[] = []
  const add = (sql: string, ...args: unknown[]) => {
    statements.push(db.prepare(sql).bind(...args.map((v) => (v === undefined ? null : v))))
  }

  // ------------------------------------------------------------------ users
  const passwords = await Promise.all(
    Array.from({ length: 5 }, () => hashPassword('demo1234')),
  )

  // ---------------------------------------------------------- organizations
  const orgs = [
    ['Aarogya Foundation', 'NGO/KA/2014/00871', 'Primary healthcare and clean water for underserved blocks of Karnataka.', 'accounts@aarogyafoundation.org', '+91 80 4123 8890', 'aarogyafoundation.org'],
    ['Vidya Setu Trust', 'NGO/MH/2011/02344', 'Learning infrastructure, scholarships and nutrition for rural Maharashtra.', 'finance@vidyasetu.org', '+91 20 2567 1140', 'vidyasetu.org'],
    ['Sahayata Relief Network', 'NGO/DL/2016/01109', 'Disaster response, shelter and relief logistics across North-East India.', 'relief@sahayatanetwork.org', '+91 11 4709 3321', 'sahayatanetwork.org'],
  ]
  orgs.forEach((o, i) => {
    add(
      'INSERT INTO organizations (id, name, registration_no, mission, contact_email, phone, website) VALUES (?, ?, ?, ?, ?, ?, ?)',
      i + 1,
      ...o,
    )
  })

  // ---------------------------------------------------------------- donors
  const donorRows: Array<[string, string, string, string]> = [
    ['Aarav Sharma', 'aarav.sharma@example.com', 'individual', 'Bengaluru'],
    ['Diya Patel', 'diya.patel@example.com', 'individual', 'Ahmedabad'],
    ['Rohan Gupta', 'rohan.gupta@example.com', 'individual', 'Delhi'],
    ['Sneha Reddy', 'sneha.reddy@example.com', 'individual', 'Hyderabad'],
    ['Kabir Nair', 'kabir.nair@example.com', 'individual', 'Kochi'],
    ['Meera Joshi', 'meera.joshi@example.com', 'individual', 'Pune'],
    ['Aditya Rao', 'aditya.rao@example.com', 'individual', 'Mysuru'],
    ['Ishaan Malhotra', 'ishaan.malhotra@example.com', 'individual', 'Gurugram'],
    ['Tanvi Desai', 'tanvi.desai@example.com', 'individual', 'Surat'],
    ['Arjun Mehta', 'arjun.mehta@example.com', 'individual', 'Mumbai'],
    ['Neha Kulkarni', 'neha.kulkarni@example.com', 'individual', 'Nagpur'],
    ['Siddharth Menon', 'siddharth.menon@example.com', 'individual', 'Chennai'],
    ['Priya Bhat', 'priya.bhat@example.com', 'individual', 'Mangaluru'],
    ['Vivaan Shah', 'vivaan.shah@example.com', 'individual', 'Vadodara'],
    ['Kavya Pillai', 'kavya.pillai@example.com', 'individual', 'Thiruvananthapuram'],
    ['Ritu Agarwal', 'ritu.agarwal@example.com', 'individual', 'Jaipur'],
    ['Manish Sinha', 'manish.sinha@example.com', 'individual', 'Patna'],
    ['Anjali Nambiar', 'anjali.nambiar@example.com', 'individual', 'Kozhikode'],
    ['Dev Choudhary', 'dev.choudhary@example.com', 'individual', 'Indore'],
    ['Lakshmi Iyer', 'lakshmi.iyer@example.com', 'individual', 'Coimbatore'],
    ['Infotech Systems Pvt Ltd', 'csr@infotechsyst.example', 'corporate', 'Bengaluru'],
    ['GreenLeaf Foods', 'giving@greenleaf.example', 'corporate', 'Pune'],
    ['NorthStar Logistics', 'csr@northstar.example', 'corporate', 'Gurugram'],
    ['Meridian Capital', 'foundation@meridian.example', 'corporate', 'Mumbai'],
    ['Sunrise Pharma', 'csr@sunrisepharma.example', 'corporate', 'Hyderabad'],
    ['Agarwal Family Trust', 'trust@agarwal.example', 'trust', 'Jaipur'],
    ['Roti Foundation', 'office@roti.example', 'trust', 'Delhi'],
    ['Vision 2030 Trust', 'grants@vision2030.example', 'trust', 'Bengaluru'],
    ['Sattva Giving Circle', 'hello@sattva.example', 'trust', 'Pune'],
    ['Bharat Care Trust', 'care@bharatcare.example', 'trust', 'Chennai'],
  ]
  donorRows.forEach((d, i) => {
    add('INSERT INTO donors (id, name, email, donor_type, city) VALUES (?, ?, ?, ?, ?)', i + 1, ...d)
  })

  // ---------------------------------------------------------------- users
  // Users must exist before campaigns/allocations reference them as creators.
  const users = [
    [1, 'admin@trustledger.org', 'Meera Krishnan', 'admin', null, null, passwords[0]],
    [2, 'staff@aarogya.org', 'Rahul Verma', 'staff', 1, null, passwords[1]],
    [3, 'staff@vidyasetu.org', 'Ananya Iyer', 'staff', 2, null, passwords[2]],
    [4, 'auditor@trustledger.org', 'Vikram Rao', 'auditor', null, null, passwords[3]],
    [5, 'donor@example.com', 'Arjun Mehta', 'donor', null, 10, passwords[4]],
  ]
  users.forEach((u) => {
    add(
      'INSERT INTO users (id, email, name, role, organization_id, donor_id, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      u[0], u[1], u[2], u[3], u[4], u[5], u[6],
    )
  })

  // ------------------------------------------------------------- campaigns
  const campaigns: CampaignSeed[] = [
    {
      id: 1, org: 1, code: 'AAR-MHC-2026', title: 'Mobile Health Clinics for Tribal Blocks',
      category: 'health', goal: 2_500_000, start: '2026-02-01', end: '2026-12-31', factor: 0.74, status: 'active',
      summary: 'Six mobile clinics bringing diagnostics, maternal care and medicines to 42 tribal hamlets.',
      description: 'Aarogya Foundation runs six fully equipped mobile health vans across Chamarajanagar, Yelandur and Raichur. Each van covers seven hamlets a week with a doctor, two nurses and a pharmacist. Funds cover vehicle leases, medicine stocks, diagnostic consumables and staff honoraria for twelve months.',
      items: [['Medical kits', 'kit', 1800], ['Wheelchairs', 'unit', 6500], ['Oxygen concentrators', 'unit', 42000]],
    },
    {
      id: 2, org: 1, code: 'AAR-WTR-2026', title: 'Clean Water for 12 Villages',
      category: 'water', goal: 1_800_000, start: '2026-03-01', end: '2026-11-30', factor: 0.66, status: 'active',
      summary: 'Borewell recharge, RO units and village water committees across Tumakuru and Kolar.',
      description: 'Twelve villages currently depend on fluoride-affected groundwater. The programme installs community RO units, recharges defunct borewells and trains a village water committee in each habitation to run regular quality tests.',
      items: [['Water filter units', 'unit', 12500], ['PVC pipe bundles', 'bundle', 4200]],
    },
    {
      id: 3, org: 1, code: 'AAR-CAR-2026', title: 'Cardiac Care Support Fund',
      category: 'health', goal: 900_000, start: '2026-04-01', end: '2026-12-15', factor: 0.82, status: 'active',
      summary: 'Emergency surgery grants for children from families below the poverty line.',
      description: 'Paediatric cardiac surgery costs between ₹1.2L and ₹3L. This fund covers the gap left after government schemes for families earning under ₹15,000 a month, with every grant paid directly to the treating hospital.',
      items: [['Post-operative care kits', 'kit', 3200]],
    },
    {
      id: 4, org: 2, code: 'VID-STM-2026', title: 'STEM Labs for Rural Schools',
      category: 'education', goal: 1_200_000, start: '2026-01-15', end: '2026-12-31', factor: 0.71, status: 'active',
      summary: 'Hands-on science and robotics labs in 18 zilla parishad schools.',
      description: 'Vidya Setu installs a complete STEM lab in each school: experiment kits, a 3D printer, robotics components and a teacher training programme. Schools contribute the room and electricity; the trust funds all equipment and training.',
      items: [['STEM lab kits', 'kit', 28000], ['Tablets for labs', 'unit', 15000]],
    },
    {
      id: 5, org: 2, code: 'VID-SCH-2026', title: 'Scholarships for 200 Girls',
      category: 'education', goal: 750_000, start: '2026-01-05', end: '2026-10-31', factor: 0.98, status: 'completed',
      summary: 'Full-year school scholarships, books and transport for 200 girls in Marathwada.',
      description: 'Each scholarship covers fees, books, a uniform allowance and bus fare for one academic year. Selection is done with school headmasters and verified by the trust field team, with attendance-linked second instalments.',
      items: [['School bags', 'unit', 1200], ['Study kits', 'kit', 950]],
    },
    {
      id: 6, org: 2, code: 'VID-NUT-2026', title: 'Nutrition for Anganwadi Centres',
      category: 'food_security', goal: 500_000, start: '2026-05-01', end: '2026-12-20', factor: 0.63, status: 'active',
      summary: 'Daily protein supplements for 900 children and 180 pregnant women.',
      description: 'Working with 14 anganwadi centres in Osmanabad, the trust supplies fortified nutrition kits, growth-monitoring charts and quarterly paediatric check-ups for children under six.',
      items: [['Nutrition kits', 'kit', 1450], ['Rice bags (25 kg)', 'bag', 1650]],
    },
    {
      id: 7, org: 3, code: 'SAH-FLD-2026', title: 'Assam Flood Relief 2026',
      category: 'disaster_relief', goal: 3_000_000, start: '2026-06-20', end: '2026-12-31', factor: 0.77, status: 'active',
      summary: 'Emergency shelter, dry rations and medical camps for flood-affected families.',
      description: 'Three waves of flooding displaced over 40,000 people across Majuli, Dhemaji and Barpeta. Sahayata runs relief camps, distributes dry ration and hygiene kits, and operates mobile medical camps in the worst-hit clusters.',
      items: [['Relief kits', 'kit', 2600], ['Tarpaulin sheets', 'bundle', 3400], ['Blankets', 'unit', 850]],
    },
    {
      id: 8, org: 3, code: 'SAH-SHL-2026', title: 'Winter Shelter Kits',
      category: 'shelter', goal: 600_000, start: '2026-08-01', end: '2026-12-31', factor: 0.52, status: 'active',
      summary: 'Insulated blankets, mats and solar lamps for families facing the winter in relief camps.',
      description: 'Families still in relief camps after the floods need protection through December and January. Each kit includes two insulated blankets, a ground mat and a solar lamp, assembled and packed by camp volunteers.',
      items: [['Winter blankets', 'unit', 780], ['Shelter kits', 'kit', 2100], ['Solar lamps', 'unit', 640]],
    },
  ]

  const campaignById = new Map(campaigns.map((c) => [c.id, c]))

  // All campaigns start active so the "only active campaigns accept gifts"
  // trigger is satisfied, then the funded one is closed at the end.
  campaigns.forEach((c) => {
    add(
      `INSERT INTO campaigns (id, organization_id, code, title, summary, description, category, goal_amount, status, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)`,
      c.id, c.org, c.code, c.title, c.summary, c.description, c.category, c.goal, c.start, c.end,
    )
  })

  // ---------------------------------------------------------- beneficiaries
  const beneficiaries: Array<[number, number, string, string, string, number]> = [
    [1, 1, 'Asha Tribal Health Camp', 'community', 'Chamarajanagar, Karnataka', 140],
    [2, 1, 'Primary Health Centre, BR Hills', 'community', 'Yelandur, Karnataka', 95],
    [3, 1, 'Lakshmi Devi', 'patient', 'Mysuru, Karnataka', 4],
    [4, 1, 'Ravi Kumar', 'patient', 'Raichur, Karnataka', 5],
    [5, 1, 'Kallanahalli Village', 'community', 'Tumakuru, Karnataka', 120],
    [6, 1, 'Doddahalli Gram Panchayat', 'community', 'Kolar, Karnataka', 90],
    [7, 2, 'Zilla Parishad School, Wardha', 'school', 'Wardha, Maharashtra', 210],
    [8, 2, 'Government High School, Baramati', 'school', 'Baramati, Maharashtra', 175],
    [9, 2, 'Anjali Wagh', 'students', 'Solapur, Maharashtra', 3],
    [10, 2, 'Sneha Patil', 'students', 'Nanded, Maharashtra', 4],
    [11, 2, 'Anganwadi Centre, Osmanabad', 'community', 'Osmanabad, Maharashtra', 65],
    [12, 2, 'Kasturba Vidyalaya, Latur', 'school', 'Latur, Maharashtra', 190],
    [13, 3, 'Majuli Island Relief Camp', 'shelter', 'Majuli, Assam', 210],
    [14, 3, 'Dhemaji Village Cluster', 'community', 'Dhemaji, Assam', 150],
    [15, 3, 'Silchar Shelter Home', 'shelter', 'Silchar, Assam', 80],
    [16, 3, 'Barpeta Flood Families', 'family', 'Barpeta, Assam', 60],
    [17, 3, 'Guwahati Winter Relief Point', 'community', 'Guwahati, Assam', 45],
    [18, 3, 'Nagaon Rural Families', 'family', 'Nagaon, Assam', 55],
  ]
  beneficiaries.forEach((b) => {
    add(
      `INSERT INTO beneficiaries (id, organization_id, name, category, location, household_size, contact, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      b[0], b[1], b[2], b[3], b[4], b[5], `+91 9${int(100000000, 899999999)}`, daysAgo(int(240, 300)),
    )
  })

  // -------------------------------------------------------------- donations
  type Alloc = {
    id: number
    campaignId: number
    beneficiaryId: number
    kind: 'fund' | 'material'
    amount: number
    quantity: number
    itemName: string | null
    unit: string | null
  }

  let donationId = 0
  let allocationId = 0
  let expenseId = 0
  let distributionId = 0
  let receiptSeq = 0
  const raisedByCampaign = new Map<number, number>()
  const donatedItems = new Map<string, number>()
  const allocations: Alloc[] = []
  const createdAllocations: Array<{ alloc: Alloc; at: string }> = []

  const channels = ['online', 'online', 'upi', 'upi', 'bank_transfer', 'bank_transfer', 'cheque', 'cash'] as const

  interface DonationInput {
    campaignId: number
    donorId: number
    at: string
    kind: 'monetary' | 'material'
    amount?: number
    itemName?: string
    unit?: string
    quantity?: number
    value?: number
    channel?: string
  }

  const logDonation = (input: DonationInput) => {
    donationId += 1
    receiptSeq += 1
    const campaign = campaignById.get(input.campaignId)!
    const at = input.at
    const receipt = `TL-${new Date(at).getUTCFullYear().toString().slice(2)}-${String(receiptSeq).padStart(5, '0')}`
    const donorName = donorRows[input.donorId - 1][0]
    add(
      `INSERT INTO donations (id, receipt_no, donor_id, campaign_id, kind, amount, item_name, unit, quantity, estimated_value, channel, status, donated_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, 2)`,
      donationId, receipt, input.donorId, input.campaignId, input.kind,
      input.kind === 'monetary' ? (input.amount ?? 0) : 0,
      input.itemName ?? null, input.unit ?? null,
      input.quantity ?? 0, input.value ?? 0,
      input.channel ?? (input.kind === 'material' ? 'in_kind' : pick(channels)),
      at,
    )
    add(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
       VALUES (2, 'Rahul Verma', 'staff', 'DONATION', 'donation', ?, ?, ?, ?)`,
      donationId,
      input.kind === 'monetary'
        ? `Recorded ₹${(input.amount ?? 0).toLocaleString('en-IN')} from ${donorName} for ${campaign.title}`
        : `Recorded ${input.quantity} × ${input.itemName} from ${donorName} for ${campaign.title}`,
      JSON.stringify({
        receipt,
        campaign: campaign.code,
        kind: input.kind,
        amount: input.amount ?? 0,
      }),
      at,
    )
    return donationId
  }

  for (const c of campaigns) {
    const scale = Math.min(2.6, Math.max(0.6, c.goal / 1_200_000))
    const target = c.goal * c.factor
    const donationCount = Math.max(14, Math.min(34, Math.round(c.goal / 85_000)))
    let raised = 0
    for (let i = 0; i < donationCount && raised < target; i += 1) {
      const donorId = int(1, donorRows.length)
      const isLarge = donorRows[donorId - 1][2] !== 'individual'
      const base = isLarge ? int(20, 90) * 1000 : int(1, 18) * 500
      const amount = round50(Math.min(base * scale, Math.max(500, target - raised)))
      const at = daysAgo(int(4, 215))
      logDonation({ campaignId: c.id, donorId, at, kind: 'monetary', amount, channel: pick(channels) })
      raised += amount
    }
    raisedByCampaign.set(c.id, raised)

    const itemCount = Math.min(c.items.length, int(1, 2))
    for (let i = 0; i < itemCount; i += 1) {
      const [itemName, unit, unitValue] = c.items[i]
      const qty = int(10, 45)
      logDonation({
        campaignId: c.id,
        donorId: int(1, donorRows.length),
        at: daysAgo(int(5, 160)),
        kind: 'material',
        itemName,
        unit,
        quantity: qty,
        value: qty * unitValue,
      })
      const key = `${c.id}|${itemName}`
      donatedItems.set(key, (donatedItems.get(key) ?? 0) + qty)
    }
  }

  // -------------------------------------------------------------- allocations
  const fundPurposes = [
    'Direct cash support for treatment and travel',
    'Programme delivery for the current quarter',
    'Monthly scholarship disbursement',
    'Field logistics and last-mile delivery',
    'Procurement of essentials for the centre',
    'Emergency shelter materials',
    'Water unit installation and testing',
  ]

  for (const c of campaigns) {
    const orgBeneficiaries = beneficiaries.filter((b) => b[1] === c.org).map((b) => b[0])
    const raised = raisedByCampaign.get(c.id) ?? 0
    if (raised <= 0) continue
    const fundTarget = raised * (0.58 + rnd() * 0.17)
    const chunks = int(2, 3)
    let allocatedFunds = 0
    for (let i = 0; i < chunks; i += 1) {
      const remaining = fundTarget - allocatedFunds
      if (remaining < 5000) break
      const amount = round50(i === chunks - 1 ? remaining : remaining * (0.4 + rnd() * 0.3))
      allocationId += 1
      const at = daysAgo(int(4, 90))
      const alloc: Alloc = {
        id: allocationId, campaignId: c.id, beneficiaryId: pick(orgBeneficiaries),
        kind: 'fund', amount, quantity: 0, itemName: null, unit: null,
      }
      allocations.push(alloc)
      createdAllocations.push({ alloc, at })
      add(
        `INSERT INTO allocations (id, reference, campaign_id, beneficiary_id, kind, amount, purpose, status, allocated_at, allocated_by)
         VALUES (?, ?, ?, ?, 'fund', ?, ?, 'allocated', ?, 3)`,
        alloc.id, `ALC-2026-${String(alloc.id).padStart(4, '0')}`, c.id, alloc.beneficiaryId, amount, pick(fundPurposes), at,
      )
      add(
        `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
         VALUES (3, 'Ananya Iyer', 'staff', 'ALLOCATE', 'allocation', ?, ?, ?, ?)`,
        alloc.id,
        `Allocated ₹${amount.toLocaleString('en-IN')} from ${c.title}`,
        JSON.stringify({ campaign: c.code, kind: 'fund', amount }),
        at,
      )
      allocatedFunds += amount
    }

    // Material allocation, capped by what was actually donated.
    const [itemName, unit] = c.items[0]
    const available = donatedItems.get(`${c.id}|${itemName}`) ?? 0
    const qty = Math.min(int(6, 20), Math.floor(available * 0.6))
    if (qty > 0) {
      allocationId += 1
      const at = daysAgo(int(5, 80))
      const mAlloc: Alloc = {
        id: allocationId, campaignId: c.id, beneficiaryId: pick(orgBeneficiaries),
        kind: 'material', amount: 0, quantity: qty, itemName, unit,
      }
      allocations.push(mAlloc)
      createdAllocations.push({ alloc: mAlloc, at })
      add(
        `INSERT INTO allocations (id, reference, campaign_id, beneficiary_id, kind, item_name, unit, quantity, purpose, status, allocated_at, allocated_by)
         VALUES (?, ?, ?, ?, 'material', ?, ?, ?, ?, 'allocated', ?, 2)`,
        mAlloc.id, `ALC-2026-${String(mAlloc.id).padStart(4, '0')}`, c.id, mAlloc.beneficiaryId, itemName, unit, qty,
        `Stock transfer of ${itemName}`, at,
      )
      add(
        `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
         VALUES (2, 'Rahul Verma', 'staff', 'ALLOCATE', 'allocation', ?, ?, ?, ?)`,
        mAlloc.id,
        `Allocated ${qty} × ${itemName} from ${c.title}`,
        JSON.stringify({ campaign: c.code, kind: 'material', quantity: qty }),
        at,
      )
    }
  }

  // ----------------------------------------------------------------- expenses
  for (const c of campaigns) {
    const allocated = allocations
      .filter((a) => a.campaignId === c.id && a.kind === 'fund')
      .reduce((sum, a) => sum + a.amount, 0)
    if (allocated <= 0) continue
    const spendTarget = allocated * (0.62 + rnd() * 0.22)
    const entries = int(3, 5)
    let spent = 0
    for (let i = 0; i < entries; i += 1) {
      const remaining = spendTarget - spent
      if (remaining < 2000) break
      const amount = round50(i === entries - 1 ? remaining : remaining * (0.25 + rnd() * 0.3))
      const category = pick(['logistics', 'procurement', 'field_operations', 'medical', 'education', 'admin', 'other'] as const)
      const at = daysAgo(int(3, 70))
      expenseId += 1
      add(
        `INSERT INTO expenses (id, voucher_no, campaign_id, category, description, amount, vendor, receipt_ref, spent_at, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 3)`,
        expenseId, `EXP-2026-${String(expenseId).padStart(4, '0')}`, c.id, category,
        pick([
          'Vehicle hire for field distribution',
          'Procurement of programme supplies',
          'Camp operations and volunteer support',
          'Medical consumables and diagnostics',
          'Teacher training venue and materials',
          'Warehouse storage and handling',
        ]),
        amount,
        pick(['Shakti Logistics', 'Bharat Supplies Co.', 'Local vendor collective', 'MedEquip India']),
        `INV-${int(1000, 9999)}`, at,
      )
      add(
        `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
         VALUES (3, 'Ananya Iyer', 'staff', 'EXPENSE', 'expense', ?, ?, ?, ?)`,
        expenseId, `Recorded ₹${amount.toLocaleString('en-IN')} expense for ${c.title}`,
        JSON.stringify({ campaign: c.code, category, amount }), at,
      )
      spent += amount
    }
  }

  // ------------------------------------------------------------ distributions
  const evidenceRefs = ['GD-2211', 'GD-2240', 'GD-2287', 'GD-2310', 'GD-2355', 'GD-2401', 'GD-2470']
  for (const { alloc, at } of createdAllocations) {
    const installments = int(1, 3)
    const ratio = rnd() < 0.35 ? 0.55 : 1
    const baseTime = new Date(at).getTime()
    const totalAmount = Math.round(alloc.amount * ratio * 100) / 100
    const totalQty = Math.round(alloc.quantity * ratio * 10) / 10
    let deliveredAmount = 0
    let deliveredQty = 0
    for (let i = 0; i < installments; i += 1) {
      // The final instalment absorbs rounding so the sum can never exceed the allocation.
      const amount = alloc.kind === 'fund'
        ? (i === installments - 1
            ? Math.round((totalAmount - deliveredAmount) * 100) / 100
            : Math.round((totalAmount / installments) * 100) / 100)
        : 0
      const quantity = alloc.kind === 'material'
        ? (i === installments - 1
            ? Math.round((totalQty - deliveredQty) * 10) / 10
            : Math.round((totalQty / installments) * 10) / 10)
        : 0
      if (amount <= 0 && quantity <= 0) continue
      deliveredAmount += amount
      deliveredQty += quantity
      distributionId += 1
      const distAt = new Date(
        Math.min(baseTime + (i + 1) * int(2, 12) * 86_400_000, BASE_TIME - 86_400_000),
      ).toISOString()
      add(
        `INSERT INTO distributions (id, reference, allocation_id, beneficiary_id, amount, quantity, evidence_ref, notes, distributed_at, distributed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2)`,
        distributionId, `DST-2026-${String(distributionId).padStart(4, '0')}`,
        alloc.id, alloc.beneficiaryId, amount, quantity,
        pick(evidenceRefs),
        alloc.kind === 'fund' ? 'Bank transfer confirmed by beneficiary' : 'Handover signed at distribution point',
        distAt,
      )
      add(
        `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
         VALUES (2, 'Rahul Verma', 'staff', 'DISTRIBUTE', 'distribution', ?, ?, ?, ?)`,
        distributionId,
        alloc.kind === 'fund'
          ? `Distributed ₹${Math.round(amount).toLocaleString('en-IN')} to beneficiary #${alloc.beneficiaryId}`
          : `Distributed ${quantity} × ${alloc.itemName} to beneficiary #${alloc.beneficiaryId}`,
        JSON.stringify({ allocation: alloc.id, kind: alloc.kind }), distAt,
      )
    }
  }

  // Close the fully funded campaign and add governance-level audit entries.
  add('UPDATE campaigns SET status = ?, goal_reached_at = ? WHERE id = 5', 'completed', daysAgo(22))
  add(
    `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
     VALUES (1, 'Meera Krishnan', 'admin', 'STATUS', 'campaign', 5, 'Marked campaign VID-SCH-2026 as completed after goal reached', ?, ?)`,
    JSON.stringify({ campaign: 'VID-SCH-2026', status: 'completed' }), daysAgo(22),
  )
  add(
    `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
     VALUES (4, 'Vikram Rao', 'auditor', 'AUDIT', 'campaign', 7, 'Reviewed flood relief expenditure vouchers — no exceptions noted', ?, ?)`,
    JSON.stringify({ campaign: 'SAH-FLD-2026', vouchers: 14 }), daysAgo(11),
  )
  add(
    `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, entity, entity_id, summary, meta, created_at)
     VALUES (1, 'Meera Krishnan', 'admin', 'CREATE', 'organization', 3, 'Verified Sahayata Relief Network registration documents', ?, ?)`,
    JSON.stringify({ organization: 'Sahayata Relief Network' }), daysAgo(140),
  )

  add("INSERT INTO app_meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", new Date().toISOString())
  add("INSERT INTO app_meta (key, value) VALUES ('schema_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value")

  // D1 batches run in a single transaction; chunk to stay inside statement limits.
  const CHUNK = 60
  for (let i = 0; i < statements.length; i += CHUNK) {
    await db.batch(statements.slice(i, i + CHUNK))
  }
}
