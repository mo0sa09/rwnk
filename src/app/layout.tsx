import type { Metadata, Viewport } from 'next'
import './globals.css'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rwnk.co'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'رَوْنَق — دليل التنظيف الاحترافي',
    template: '%s | رَوْنَق',
  },
  description: 'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف بمعايير الفنادق الخمس نجوم. تحميل فوري، ضمان 7 أيام.',
  keywords: ['تنظيف منزلي', 'تدريب عاملات', 'دليل تنظيف', 'تنظيف احترافي', 'رونق', 'الكويت'],
  authors: [{ name: 'رَوْنَق', url: APP_URL }],
  openGraph: {
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل تدريبي يحوّل عاملتك إلى خبيرة تنظيف بمعايير 5 نجوم',
    url: APP_URL,
    siteName: 'رَوْنَق',
    locale: 'ar_KW',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'رَوْنَق — دليل التنظيف الاحترافي',
    description: 'دليل تدريبي يحوّل عاملتك إلى خبيرة تنظيف',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6747B2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
