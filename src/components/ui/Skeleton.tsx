import { CSSProperties } from 'react'

export function Skeleton({ width = '100%', height = '20px', radius = '8px', style }: {
  width?: string | number; height?: string | number; radius?: string; style?: CSSProperties
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #f0edf8 25%, #e8e4f2 50%, #f0edf8 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #EDE8F5', borderRadius: 20, padding: 24 }}>
      <Skeleton height="16px" width="40%" radius="6px" style={{ marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="12px" width={i === lines - 1 ? '60%' : '100%'} radius="6px" style={{ marginBottom: 10 }} />
      ))}
    </div>
  )
}
