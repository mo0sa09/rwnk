import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'دخول العملاء',
  description: 'سجّلي الدخول لحسابك في رَوْنَق للوصول إلى مكتبتك وتحميل كتابك.',
  openGraph: { title: 'دخول العملاء | رَوْنَق', description: 'سجّلي الدخول لحسابك في رَوْنَق.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'دخول العملاء | رَوْنَق', description: 'سجّلي الدخول لحسابك في رَوْنَق.' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
