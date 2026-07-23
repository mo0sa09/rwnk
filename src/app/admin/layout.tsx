import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'لوحة التحكم',
  description: 'لوحة تحكم رَوْنَق الإدارية.',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
