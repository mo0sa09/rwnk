import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  description: 'أنشئي حساباً في رَوْنَق لإدارة مشترياتك وتحميل كتابك في أي وقت.',
  openGraph: { title: 'إنشاء حساب | رَوْنَق', description: 'أنشئي حساباً في رَوْنَق لإدارة مشترياتك.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'إنشاء حساب | رَوْنَق', description: 'أنشئي حساباً في رَوْنَق لإدارة مشترياتك.' },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
