import { CSSProperties, ReactNode } from 'react'
import { C, R } from '@/lib/theme'

type Variant = 'purple' | 'green' | 'amber' | 'red' | 'gray'

const VARIANTS: Record<Variant, { bg: string; color: string }> = {
  purple: { bg: C.primaryLight, color: C.primaryText },
  green:  { bg: C.secondaryBg, color: '#085041' },
  amber:  { bg: C.highlightBg, color: '#633806' },
  red:    { bg: C.errorBg, color: C.error },
  gray:   { bg: C.surface, color: C.text3 },
}

export function Badge({ children, variant = 'gray', style }: { children: ReactNode; variant?: Variant; style?: CSSProperties }) {
  const v = VARIANTS[variant]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      padding: '3px 10px',
      borderRadius: R.full,
      background: v.bg,
      color: v.color,
      display: 'inline-block',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </span>
  )
}
