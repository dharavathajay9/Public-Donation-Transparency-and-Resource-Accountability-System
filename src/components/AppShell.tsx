import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'
import { Logo } from './Brand'
import { Avatar, Badge, Button, Icon, cn } from './ui'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  roles?: Role[]
}

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [{ to: '/app', label: 'Dashboard', icon: 'grid', end: true }],
  },
  {
    label: 'Fund ledger',
    items: [
      { to: '/app/donations', label: 'Donations', icon: 'heart' },
      { to: '/app/campaigns', label: 'Campaigns', icon: 'flag' },
      { to: '/app/beneficiaries', label: 'Beneficiaries', icon: 'users' },
    ],
  },
  {
    label: 'Accountability',
    items: [
      { to: '/app/allocations', label: 'Allocations', icon: 'share' },
      { to: '/app/expenses', label: 'Expenses', icon: 'receipt' },
      { to: '/app/reports', label: 'Reports', icon: 'chart' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { to: '/app/audit', label: 'Audit trail', icon: 'shield', roles: ['admin', 'auditor'] },
      { to: '/app/users', label: 'Team access', icon: 'userCog', roles: ['admin'] },
    ],
  },
]

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  staff: 'Organization staff',
  auditor: 'Auditor',
  donor: 'Donor',
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  if (!user) return null

  const allItems = GROUPS.flatMap((group) => group.items).filter(
    (item) => !item.roles || item.roles.includes(user.role),
  )
  const active =
    [...allItems]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
      ?.label ?? 'Workspace'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-white">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Link to="/app">
          <Logo inverted />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(user.role))
          if (!items.length) return null
          return (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {group.label}
              </p>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition',
                      isActive
                        ? 'bg-white/12 font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                        : 'text-white/65 hover:bg-white/6 hover:text-white',
                    )
                  }
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0 opacity-80" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-white/6 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-300/20 text-[11px] font-semibold text-brand-100">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0])
                .join('')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user.name}</p>
              <p className="truncate text-[10px] text-white/45">
                {user.organization_name ?? ROLE_LABEL[user.role]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Link
          to="/"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] text-white/45 transition hover:text-white/80"
        >
          <Icon name="arrowUpRight" className="h-3 w-3" />
          View public site
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-sand-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-rise relative h-full w-64 shadow-lift">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-sand-200 bg-sand-50/85 px-4 backdrop-blur-lg sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-ink-600 hover:bg-sand-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">Workspace</p>
              <h1 className="text-sm font-semibold text-ink-900">{active}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {user.role === 'auditor' ? (
              <Badge tone="gold" className="hidden sm:inline-flex">
                Read-only access
              </Badge>
            ) : null}
            {user.organization_name ? (
              <span className="hidden max-w-[180px] truncate text-xs text-ink-500 md:inline">
                {user.organization_name}
              </span>
            ) : null}
            <Link to="/" className="hidden sm:block">
              <Button variant="ghost" size="sm" icon="arrowUpRight">
                Public site
              </Button>
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-sand-200 bg-white py-1 pl-1 pr-3 shadow-sm">
              <Avatar name={user.name} size="sm" />
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-[11px] font-medium text-ink-800">{user.name.split(' ')[0]}</p>
                <p className="text-[9px] uppercase tracking-wide text-ink-400">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
