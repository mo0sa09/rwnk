import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'حسابي',
  description: 'إدارة بيانات حسابك ومشترياتك في رَوْنَق.',
  robots: { index: false, follow: false },
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children
}
