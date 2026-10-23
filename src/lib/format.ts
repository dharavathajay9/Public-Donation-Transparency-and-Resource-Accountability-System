export function inr(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function inrPrecise(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function compactInr(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  if (Math.abs(amount) >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`
  if (Math.abs(amount) >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`
  if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(0)}k`
  return inr(amount)
}

export function number(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('en-IN')
}

export function date(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function monthLabel(value: string): string {
  const [year, month] = value.split('-')
  const parsed = new Date(Number(year), Number(month) - 1, 1)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(value: string): string {
  const parsed = new Date(value).getTime()
  if (Number.isNaN(parsed)) return value
  const diff = Date.now() - parsed
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return date(value)
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.min(100, Math.max(0, (part / whole) * 100))
}

export function inputDate(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

export const CATEGORY_COLORS: Record<string, string> = {
  health: '#1d7360',
  education: '#3f7cac',
  disaster_relief: '#c0603a',
  food_security: '#b07823',
  water: '#2b8f9c',
  livelihood: '#7a5ea8',
  environment: '#4a8f4a',
  shelter: '#8c6a4f',
}

export const CHART_COLORS = [
  '#1d7360',
  '#4aab90',
  '#b07823',
  '#3f7cac',
  '#c0603a',
  '#7a5ea8',
  '#4a8f4a',
  '#8c6a4f',
]
