export type Role = 'admin' | 'staff' | 'auditor' | 'donor'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ENVIRONMENT?: string
}

export interface SessionUser {
  id: number
  email: string
  name: string
  role: Role
  organization_id: number | null
  organization_name: string | null
  donor_id: number | null
}

export type AppEnv = {
  Bindings: Env
  Variables: {
    user: SessionUser | null
  }
}

export const CATEGORIES = [
  'health',
  'education',
  'disaster_relief',
  'food_security',
  'water',
  'livelihood',
  'environment',
  'shelter',
] as const

export const EXPENSE_CATEGORIES = [
  'logistics',
  'procurement',
  'medical',
  'education',
  'field_operations',
  'utilities',
  'admin',
  'other',
] as const
