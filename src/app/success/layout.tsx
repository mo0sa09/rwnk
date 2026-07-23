import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'تم الشراء بنجاح',
  description: 'شكراً لشرائك — تفاصيل طلبك ورابط تحميل كتاب رَوْنَق.',
  robots: { index: false, follow: false },
}

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
