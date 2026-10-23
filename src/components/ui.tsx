import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ icons */

const ICONS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  heart: <path d="M19.5 12.6 12 20l-7.5-7.4A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 7.5 6.3Z" />,
  flag: (
    <>
      <path d="M5 15s1-1 4-1 4 2 7 2 4-1 4-1V4s-1 1-4 1-4-2-7-2-4 1-4 1Z" />
      <path d="M5 21v-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 6.2" />
      <path d="M18 14.5a6 6 0 0 1 3.5 5.5" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
      <path d="m8.4 10.8 7.2-3.6M8.4 13.2l7.2 3.6" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3v18l2-1.4L9 21l2-1.4L13 21l2-1.4L17 21l2-1.4V3l-2 1.4L15 3l-2 1.4L11 3 9 4.4 7 3 5 4.4Z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12.5 16V8M17 16v-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 21.5s7.5-3.6 7.5-9.5V5.6L12 2.8 4.5 5.6V12c0 5.9 7.5 9.5 7.5 9.5Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  userCog: (
    <>
      <circle cx="9" cy="7.5" r="3.4" />
      <path d="M2.5 20.5a6.6 6.6 0 0 1 10.4-5.3" />
      <circle cx="18" cy="17" r="2.4" />
      <path d="M18 12.8v1.6M18 19.6v1.6M21.8 17h-1.6M15.8 17h-1.6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />,
  printer: (
    <>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M7 16h10v5H7z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  badge: (
    <>
      <path d="M12 2.8 14.6 5l3.2.3.3 3.2L20.5 11 19 13.5l.4 3.2-3.1.8L14 20l-2-2-2 2-2.3-2.5-3.1-.8.4-3.2L3.5 11 5.9 8.5l.3-3.2L9.4 5Z" />
      <path d="m9 11.8 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  box: (
    <>
      <path d="m12 2.8 8.5 4.6v9.2L12 21.2 3.5 16.6V7.4Z" />
      <path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2.8 9 4.6-9 4.6-9-4.6Z" />
      <path d="m3 12.5 9 4.6 9-4.6M3 17l9 4.6 9-4.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="M5 7 2.5 13a3 3 0 0 0 5 0ZM19 7l-2.5 6a3 3 0 0 0 5 0Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
}

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.7,
}: {
  name: keyof typeof ICONS | string
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  )
}

/* ----------------------------------------------------------------- button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'dark'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: string
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 border border-brand-700',
  secondary:
    'bg-white text-ink-800 border border-sand-300 hover:border-brand-400 hover:text-brand-800 shadow-sm',
  ghost: 'text-ink-600 hover:bg-sand-100 hover:text-ink-900 border border-transparent',
  soft: 'bg-brand-50 text-brand-800 border border-brand-100 hover:bg-brand-100',
  danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700',
  dark: 'bg-ink-900 text-white border border-ink-900 hover:bg-ink-800',
}

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      ) : null}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------ surfaces */

export function Card({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string
  children: ReactNode
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={cn('rounded-2xl border border-sand-200 bg-white shadow-card', className)}>
      {children}
    </Tag>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="display text-2xl text-ink-900 sm:text-3xl">{title}</h2>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="display text-3xl text-ink-900">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ badge */

type BadgeTone = 'brand' | 'gold' | 'red' | 'slate' | 'blue' | 'outline'

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-50 text-brand-800 border-brand-100',
  gold: 'bg-gold-100 text-gold-700 border-gold-200',
  red: 'bg-red-50 text-red-700 border-red-100',
  slate: 'bg-sand-100 text-ink-600 border-sand-200',
  blue: 'bg-sky-50 text-sky-800 border-sky-100',
  outline: 'bg-white text-ink-600 border-sand-300',
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'brand',
  completed: 'blue',
  paused: 'gold',
  draft: 'slate',
  allocated: 'gold',
  partially_distributed: 'blue',
  distributed: 'brand',
  received: 'slate',
  utilized: 'brand',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'slate'}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

/* ------------------------------------------------------------------ forms */

export const inputClass =
  'w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:bg-sand-100 disabled:text-ink-400'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-700">
        <span>
          {label}
          {required ? <span className="ml-0.5 text-brand-600">*</span> : null}
        </span>
        {hint ? <span className="font-normal text-ink-400">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(inputClass, 'appearance-none pr-9', props.className)}
      />
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
      />
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-[84px] resize-y', props.className)} />
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-900/45 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-rise relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-sand-200 bg-white shadow-lift sm:rounded-2xl',
          width,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-sand-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-sand-100 hover:text-ink-700"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-sand-200 bg-sand-50/70 px-5 py-4 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/* ----------------------------------------------------------------- tables */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'sticky top-0 z-[1] whitespace-nowrap border-b border-sand-200 bg-sand-50/80 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400 backdrop-blur',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-sand-100 px-4 py-3 text-sm text-ink-700', className)}>
      {children}
    </td>
  )
}

export function EmptyState({
  icon = 'sparkle',
  title,
  description,
  action,
  className,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon name={icon} />
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-sand-200/70', className)} />
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-ink-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600">
        <Icon name="alert" className="h-5 w-5" />
      </div>
      <p className="text-sm text-red-700">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
  showTrack = true,
}: {
  value: number
  max?: number
  tone?: 'brand' | 'gold' | 'blue'
  className?: string
  showTrack?: boolean
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const tones = {
    brand: 'bg-brand-600',
    gold: 'bg-gold-400',
    blue: 'bg-sky-600',
  }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full', showTrack && 'bg-sand-200', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' }
  const label = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-800',
        sizes[size],
      )}
    >
      {label}
    </span>
  )
}

/* ------------------------------------------------------------- pagination */

export function Pagination({
  page,
  perPage,
  total,
  onChange,
}: {
  page: number
  perPage: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (total <= perPage) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-xs text-ink-400">
        <span>
          {total} record{total === 1 ? '' : 's'}
        </span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs text-ink-400">
        Page {page} of {pages} · {total.toLocaleString('en-IN')} records
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- toasts */

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 5200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'animate-rise pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lift backdrop-blur',
              item.tone === 'success' && 'border-brand-200 bg-white text-ink-800',
              item.tone === 'error' && 'border-red-200 bg-white text-red-800',
              item.tone === 'info' && 'border-sand-300 bg-white text-ink-700',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                item.tone === 'success' && 'bg-brand-100 text-brand-700',
                item.tone === 'error' && 'bg-red-100 text-red-600',
                item.tone === 'info' && 'bg-sand-100 text-ink-500',
              )}
            >
              <Icon
                name={item.tone === 'success' ? 'check' : item.tone === 'error' ? 'alert' : 'info'}
                className="h-3.5 w-3.5"
              />
            </span>
            <span className="leading-snug">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
