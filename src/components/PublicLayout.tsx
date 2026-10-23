import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Logo } from './Brand'
import { Button, Icon, cn } from './ui'

const NAV = [
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/ledger', label: 'Public ledger' },
  { to: '/#how', label: 'How it works' },
]

export default function PublicLayout() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-sand-200/80 bg-sand-50/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link to="/" onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) =>
              item.to.startsWith('/#') ? (
                <a
                  key={item.to}
                  href={item.to}
                  className="rounded-lg px-3 py-2 text-sm text-ink-600 transition hover:bg-sand-100 hover:text-ink-900"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm transition',
                      isActive
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <span className="text-xs text-ink-400">{user.name}</span>
                <Link to="/app">
                  <Button size="sm" icon="grid">
                    Open workspace
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="px-2 text-sm text-ink-600 transition hover:text-ink-900">
                  Sign in
                </Link>
                <Link to="/login">
                  <Button size="sm" icon="arrowRight">
                    View the ledger
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-ink-600 transition hover:bg-sand-100 md:hidden"
            aria-label="Toggle navigation"
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>

        {open ? (
          <div className="border-t border-sand-200 bg-sand-50 px-5 pb-5 pt-2 md:hidden">
            <nav className="flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to.startsWith('/#') ? '/' : item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-ink-700 hover:bg-sand-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex gap-2 border-t border-sand-200 pt-3">
              {user ? (
                <Link to="/app" className="flex-1" onClick={() => setOpen(false)}>
                  <Button className="w-full" size="sm">
                    Open workspace
                  </Button>
                </Link>
              ) : (
                <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                  <Button className="w-full" size="sm">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main key={location.pathname} className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sand-200 bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
              A public record of every donation, allocation, expense and distribution — maintained
              under database-enforced accountability rules.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-ink-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
              Ledger status: live and append-only
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Transparency
            </h3>
            <ul className="space-y-2 text-sm text-ink-600">
              <li>
                <Link to="/campaigns" className="hover:text-brand-700">
                  Browse campaigns
                </Link>
              </li>
              <li>
                <Link to="/ledger" className="hover:text-brand-700">
                  Public ledger
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-brand-700">
                  Organization sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Accountability
            </h3>
            <ul className="space-y-2 text-sm text-ink-600">
              <li>Immutable donation records</li>
              <li>Budget-guarded expenditure</li>
              <li>Beneficiary-level delivery</li>
              <li>Append-only audit trail</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-sand-200">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-ink-400">
            <span>© {new Date().getFullYear()} TrustLedger. A demonstration of transparent fund governance.</span>
            <span className="font-mono text-[10px] uppercase tracking-wider">DBMS · SQL · transactions</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
