// Full-page wrapper with consistent background + font
import { ReactNode } from 'react'
import { C } from '@/lib/theme'

export function PageShell({ children, bg }: { children: ReactNode; bg?: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: bg ?? C.bg,
      fontFamily: "'Th','Noto Kufi Arabic',serif",
      color: C.text1,
      direction: 'rtl',
    }}>
      {children}
    </div>
  )
}
