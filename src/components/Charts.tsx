import { compactInr, inr } from '../lib/format'
import { cn } from './ui'

export interface ChartPoint {
  label: string
  value: number
}

const PALETTE = ['#1d7360', '#4aab90', '#b07823', '#3f7cac', '#c0603a', '#7a5ea8', '#4a8f4a', '#8c6a4f']

export function Donut({
  data,
  size = 168,
  thickness = 20,
  centerLabel,
  centerValue,
}: {
  data: ChartPoint[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel ?? 'Breakdown'}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0eee6" strokeWidth={thickness} />
          {total > 0 &&
            data.map((item, index) => {
              const fraction = item.value / total
              const dash = fraction * circumference
              const segment = (
                <circle
                  key={item.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={PALETTE[index % PALETTE.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circumference - Math.max(dash - 1.5, 0)}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>{`${item.label}: ${inr(item.value)}`}</title>
                </circle>
              )
              offset += dash
              return segment
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            {centerLabel}
          </span>
          <span className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{centerValue}</span>
        </div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-2">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
            />
            <span className="flex-1 capitalize text-ink-600">{item.label.replace(/_/g, ' ')}</span>
            <span className="font-medium tabular-nums text-ink-800">{compactInr(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ColumnChart({
  data,
  height = 168,
  emptyLabel = 'No data yet',
}: {
  data: ChartPoint[]
  height?: number
  emptyLabel?: string
}) {
  const max = Math.max(...data.map((item) => item.value), 1)
  if (!data.length) {
    return (
      <div className="grid h-40 place-items-center text-xs text-ink-400">{emptyLabel}</div>
    )
  }
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height }}>
        {data.map((item) => {
          const barHeight = item.value > 0 ? Math.max(3, (item.value / max) * 100) : 0
          return (
            <div key={item.label} className="group flex h-full flex-1 flex-col justify-end">
              <div className="relative flex-1">
                <div
                  className="absolute bottom-0 w-full rounded-t-[5px] bg-brand-600/80 transition-colors group-hover:bg-brand-700"
                  style={{ height: `${barHeight}%` }}
                >
                  <title>{`${item.label}: ${inr(item.value)}`}</title>
                </div>
              </div>
              <span className="mt-2 truncate text-center text-[9px] uppercase tracking-wide text-ink-400">
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TrendChart({
  data,
  height = 176,
  className,
}: {
  data: ChartPoint[]
  height?: number
  className?: string
}) {
  const width = 640
  const padX = 10
  const padTop = 16
  const baseY = height - 26
  const max = Math.max(...data.map((point) => point.value), 1)

  if (data.length < 2) {
    return (
      <div className={cn('grid place-items-center text-xs text-ink-400', className)} style={{ height }}>
        Not enough history yet
      </div>
    )
  }

  const step = (width - padX * 2) / (data.length - 1)
  const points = data.map((point, index) => {
    const x = padX + index * step
    const y = padTop + (1 - point.value / max) * (baseY - padTop)
    return [x, y] as const
  })

  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${baseY} L${points[0][0].toFixed(1)},${baseY} Z`

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Monthly donation trend"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2b8f75" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2b8f75" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padTop + (1 - ratio) * (baseY - padTop)}
            y2={padTop + (1 - ratio) * (baseY - padTop)}
            stroke="#e8e4d8"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke="#1d7360" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], index) => (
          <circle key={data[index].label} cx={x} cy={y} r="3" fill="#fff" stroke="#1d7360" strokeWidth="2">
            <title>{`${data[index].label}: ${inr(data[index].value)}`}</title>
          </circle>
        ))}
        {data.map((point, index) => (
          <text
            key={point.label}
            x={padX + index * step}
            y={height - 6}
            textAnchor="middle"
            className="fill-ink-400"
            fontSize="9"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export function FundFlow({
  raised,
  allocated,
  spent,
}: {
  raised: number
  allocated: number
  spent: number
}) {
  const safeRaised = raised > 0 ? raised : 1
  const spentWidth = Math.min(100, (spent / safeRaised) * 100)
  const committedWidth = Math.min(100 - spentWidth, Math.max(0, (allocated - spent) / safeRaised * 100))
  const availableWidth = Math.max(0, 100 - spentWidth - committedWidth)

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-sand-200">
        <div className="h-full bg-brand-700" style={{ width: `${spentWidth}%` }} title={`Spent ${inr(spent)}`} />
        <div
          className="h-full bg-brand-300"
          style={{ width: `${committedWidth}%` }}
          title={`Committed but unspent ${inr(Math.max(0, allocated - spent))}`}
        />
        <div className="h-full bg-sand-300" style={{ width: `${availableWidth}%` }} title={`Unallocated ${inr(Math.max(0, raised - allocated))}`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-700" /> Spent {compactInr(spent)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-300" /> Committed {compactInr(Math.max(0, allocated - spent))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sand-300" /> Unallocated {compactInr(Math.max(0, raised - allocated))}
        </span>
      </div>
    </div>
  )
}

export function Sparkbars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className={cn('flex h-8 items-end gap-0.5', className)}>
      {values.map((value, index) => (
        <span
          key={index}
          className="flex-1 rounded-sm bg-brand-300"
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}
