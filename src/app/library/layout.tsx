import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'مكتبتي',
  description: 'مكتبتك الشخصية — حمّلي كتاب رَوْنَق وتابعي مشترياتك.',
  robots: { index: false, follow: false },
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children
}
