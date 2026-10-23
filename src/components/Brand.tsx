import { cn } from './ui'

export function LogoMark({ className = 'h-9 w-9', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-xl',
        inverted ? 'bg-white/10 ring-1 ring-white/20' : 'bg-brand-800',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none">
        <path
          d="M12 21.4s7.4-3.5 7.4-9.4V5.6L12 2.8 4.6 5.6V12c0 5.9 7.4 9.4 7.4 9.4Z"
          stroke={inverted ? '#ffffff' : '#d6efe6'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8.4 11.6h7.2M8.4 14.6h4.6" stroke={inverted ? '#ffffff' : '#7dc9b1'} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 8.8h6" stroke={inverted ? '#ffffff' : '#7dc9b1'} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark inverted={inverted} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[19px] tracking-tight',
            inverted ? 'text-white' : 'text-ink-900',
          )}
        >
          TrustLedger
        </span>
        <span
          className={cn(
            'mt-1 text-[9px] font-medium uppercase tracking-[0.18em]',
            inverted ? 'text-white/55' : 'text-ink-400',
          )}
        >
          Donation accountability
        </span>
      </span>
    </span>
  )
}
