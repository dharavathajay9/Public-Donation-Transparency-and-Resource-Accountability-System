export type Role = 'admin' | 'staff' | 'auditor' | 'donor'

export interface User {
  id: number
  email: string
  name: string
  role: Role
  organization_id: number | null
  organization_name: string | null
  donor_id: number | null
}

export interface Campaign {
  campaign_id: number
  organization_id: number
  organization_name: string
  code: string
  title: string
  category: string
  status: string
  goal_amount: number
  start_date: string
  end_date: string | null
  raised: number
  material_value: number
  donation_count: number
  donor_count: number
  allocated: number
  spent: number
  distribution_count: number
  beneficiary_count: number
  progress?: number
  summary?: string
  description?: string
  organization_mission?: string
  organization_verified?: number
  organization_website?: string
  organization_registration?: string
  goal_reached_at?: string | null
  unallocated?: number
  balance?: number
  committed_balance?: number
}

export interface Organization {
  id: number
  name: string
  verified: number
  mission?: string
  registration_no?: string
  contact_email?: string
  phone?: string
  website?: string
  campaigns: number
  beneficiaries: number
  raised: number
  spent: number
  material_value: number
}

export interface Donation {
  id?: number
  receipt_no: string
  kind: 'monetary' | 'material'
  amount: number
  item_name: string | null
  unit?: string | null
  quantity: number
  estimated_value: number
  channel: string
  donated_at: string
  notes?: string | null
  donor_id?: number
  donor_name: string
  donor_type: string
  donor_city?: string | null
  campaign_id?: number
  campaign_title: string
  campaign_code?: string
  organization_name?: string
}

export interface Allocation {
  id: number
  reference: string
  campaign_id: number
  organization_id: number
  campaign_title: string
  campaign_code: string
  beneficiary_id: number
  beneficiary_name: string
  beneficiary_category: string
  beneficiary_location: string
  kind: 'fund' | 'material'
  amount: number
  item_name: string | null
  unit: string | null
  quantity: number
  purpose: string
  status: string
  allocated_at: string
  distributed_amount: number
  distributed_quantity: number
  distribution_count: number
}

export interface Beneficiary {
  id: number
  organization_id: number
  organization_name: string
  name: string
  category: string
  location: string
  household_size: number
  verified: number
  allocation_count: number
  funds_allocated: number
  funds_received: number
  items_received: number
  distributions_received: number
}

export interface Expense {
  id: number
  voucher_no: string
  campaign_id: number
  category: string
  description: string
  amount: number
  vendor: string | null
  receipt_ref: string | null
  spent_at: string
  campaign_title: string
  campaign_code: string
  organization_name: string
}

export interface Distribution {
  id: number
  reference: string
  allocation_id: number
  allocation_reference?: string
  allocation_kind?: string
  amount: number
  quantity: number
  evidence_ref: string | null
  notes: string
  distributed_at: string
  beneficiary_name: string
  location?: string
  campaign_title: string
  item_name?: string | null
}

export interface AuditEntry {
  id: number
  actor_name: string
  actor_role: string
  action: string
  entity: string
  entity_id: number | null
  summary: string
  meta: string
  ip?: string
  created_at: string
}

export interface PublicStats {
  stats: {
    campaigns: number
    organizations: number
    donors: number
    beneficiaries: number
    donations_count: number
    raised: number
    material_value: number
    spent: number
    distributed_funds: number
    distributions: number
    audit_entries: number
  }
  organizations: Organization[]
  recent_activity: AuditEntry[]
}

export interface MetaCampaign {
  id: number
  code: string
  title: string
  organization_id: number
  organization_name: string
  status: string
  goal_amount: number
  raised: number
  allocated: number
  spent: number
}

export interface Meta {
  organizations: Array<{ id: number; name: string; verified: number }>
  campaigns: MetaCampaign[]
  donors: Array<{
    id: number
    name: string
    email: string | null
    donor_type: string
    city: string | null
  }>
  beneficiaries: Array<{
    id: number
    organization_id: number
    name: string
    category: string
    location: string
    household_size: number
  }>
}

export interface Kpis {
  raised: number
  material_value: number
  allocated: number
  spent: number
  available: number
  balance: number
  campaigns: number
  active_campaigns: number
  donations: number
  beneficiaries: number
  pending_allocations: number
  distributions: number
  distributed_value: number
  audit_entries: number
  expense_entries: number
}

export interface DashboardData {
  role: Role
  organization: string | null
  scope_label?: string
  kpis: Partial<Kpis> & { count?: number; given?: number; in_kind?: number; campaigns?: number; last_at?: string }
  monthly?: Array<{ month: string; monetary: number; material: number; donations: number }>
  expense_categories?: Array<{ category: string; total: number; entries: number }>
  allocation_status?: Array<{ status: string; n: number; amount: number }>
  campaigns: Array<Campaign & { progress: number }>
  activity?: Array<
    AuditEntry & {
      receipt_no?: string
      donor_name?: string
      campaign_title?: string
      kind?: string
      amount?: number
      donated_at?: string
    }
  >
  activity_kind?: string
  donations?: Donation[]
}
