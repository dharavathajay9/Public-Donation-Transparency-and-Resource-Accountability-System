import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Brand'
import { Badge, Button, Field, Icon, TextInput, cn } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compactInr } from '../lib/format'
import type { PublicStats } from '../lib/types'
import { useApi } from '../lib/api'

const DEMO_ACCOUNTS = [
  {
    role: 'Administrator',
    email: 'admin@trustledger.org',
    name: 'Meera Krishnan',
    description: 'Full platform access, user management, audit trail.',
  },
  {
    role: 'Staff',
    email: 'staff@aarogya.org',
    name: 'Rahul Verma',
    description: 'Aarogya Foundation — records donations, expenses, distributions.',
  },
  {
    role: 'Auditor',
    email: 'auditor@trustledger.org',
    name: 'Vikram Rao',
    description: 'Read-only review of every record and the audit trail.',
  },
  {
    role: 'Donor',
    email: 'donor@example.com',
    name: 'Arjun Mehta',
    description: 'Sees only their own giving history.',
  },
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const stats = useApi<PublicStats>('/public/stats')

  const [email, setEmail] = useState('admin@trustledger.org')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, from, navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in right now.')
    } finally {
      setLoading(false)
    }
  }

  const s = stats.data?.stats

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-24 h-[420px] w-[420px] rounded-full bg-brand-700/30 blur-[100px]" />
          <div className="absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-gold-400/10 blur-[90px]" />
          <div className="grain absolute inset-0 opacity-40" />
        </div>

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative mt-auto max-w-md">
          <h1 className="display text-4xl leading-tight">
            Trust is a ledger,
            <br />
            <span className="italic text-brand-200">not a promise.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Sign in to record contributions, allocate resources, log expenditure and publish every
            step to the public ledger.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 border-y border-white/10 py-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Raised</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s ? compactInr(s.raised) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Deliveries</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s?.distributions ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Audit entries</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s?.audit_entries ?? '—'}</p>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            <p className="text-[11px] leading-relaxed text-white/55">
              Role-based access separates organization staff, administrators and auditors. Read-only
              accounts cannot alter a single record.
            </p>
          </div>
        </div>

        <p className="relative mt-10 text-[10px] uppercase tracking-[0.18em] text-white/25">
          TrustLedger · transparent fund governance
        </p>
      </div>

      {/* form panel */}
      <div className="flex flex-col bg-sand-50 px-5 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
              Secure sign in
            </p>
            <h2 className="display mt-2 text-3xl text-ink-900">Welcome back</h2>
            <p className="mt-2 text-sm text-ink-500">
              Use your organization email. This is a demonstration environment.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Email address" required>
              <TextInput
                type="email"
                value={email}
                autoComplete="username"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@organization.org"
                required
              />
            </Field>
            <Field label="Password" required>
              <TextInput
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" loading={loading} icon="lock">
              Sign in to workspace
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-sand-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-900">Demo accounts</p>
              <Badge tone="gold">password: demo1234</Badge>
            </div>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('demo1234')
                    setError(null)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
                    email === account.email ? 'bg-brand-50' : 'hover:bg-sand-50',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-[10px] font-semibold uppercase text-ink-500">
                    {account.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-800">
                      {account.role}
                      <span className="text-[10px] font-normal text-ink-400">· {account.name}</span>
                    </span>
                    <span className="block truncate text-[10px] text-ink-400">{account.email}</span>
                  </span>
                  {email === account.email ? (
                    <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" />
                  ) : (
                    <Icon name="arrowRight" className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-ink-400">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-ink-800">
              <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-180" />
              Back to public site
            </Link>
            <Link to="/campaigns" className="hover:text-ink-800">
              Browse campaigns
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
