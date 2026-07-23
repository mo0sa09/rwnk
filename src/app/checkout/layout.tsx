import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'إتمام الشراء',
  description: 'أكملي عملية الشراء واحصلي على كتاب رَوْنَق فوراً — دفع آمن ومشفّر.',
  openGraph: { title: 'إتمام الشراء | رَوْنَق', description: 'أكملي عملية الشراء واحصلي على كتاب رَوْنَق فوراً.', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'إتمام الشراء | رَوْنَق', description: 'أكملي عملية الشراء واحصلي على كتاب رَوْنَق فوراً.' },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
