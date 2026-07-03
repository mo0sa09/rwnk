import { ReactNode, CSSProperties } from 'react'
import { C, R, SH } from '@/lib/theme'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  hover?: boolean
  elevated?: boolean
  bordered?: boolean
  radius?: keyof typeof R
  padding?: string
}

export function Card({ children, style, hover = false, elevated = false, bordered = true, radius = 'xl', padding = '24px' }: CardProps) {
  return (
    <div style={{
      background: C.bg,
      border: bordered ? `1px solid ${C.border}` : 'none',
      borderRadius: R[radius],
      padding,
      boxShadow: elevated ? SH.card : 'none',
      transition: hover ? 'all .2s ease' : 'none',
      ...style,
    }}>
      {children}
    </div>
  )
}
