import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PageShell } from '@/components/ui/PageShell'
import { getFaqs } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'

const P = '#6747B2', T1 = '#1A1228', T2 = '#4A4060', BR = '#EDE8F5'

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description: 'إجابات على أكثر الأسئلة شيوعاً حول كتاب رَوْنَق ودليل التنظيف الاحترافي.',
  openGraph: {
    title: 'الأسئلة الشائعة | رَوْنَق',
    description: 'إجابات على أكثر الأسئلة شيوعاً حول كتاب رَوْنَق ودليل التنظيف الاحترافي.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الأسئلة الشائعة | رَوْنَق',
    description: 'إجابات على أكثر الأسئلة شيوعاً حول كتاب رَوْنَق ودليل التنظيف الاحترافي.',
  },
}

export default async function FaqPage() {
  const [faqs, settings] = await Promise.all([getFaqs(), getStoreSettings()])
  return (
    <PageShell bg="#FAFAFA">
      <Navbar />
      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 clamp(20px,6vw,40px)' }}>
          <h1 style={{ fontSize: 'clamp(24px,5.5vw,34px)', fontWeight: 900, letterSpacing: -0.8, marginBottom: 8, color: T1 }}>الأسئلة الشائعة</h1>
          <p style={{ fontSize: 15, color: T2, marginBottom: 32 }}>كل ما تحتاجين معرفته عن كتاب رَوْنَق قبل الشراء.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
            {faqs.map(faq => (
              <div key={faq.id} style={{ background: '#fff', border: `1px solid ${BR}`, borderRadius: 14, padding: '18px 22px' }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: T1, marginBottom: 8 }}>{faq.question}</div>
                <div style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>{faq.answer}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <Link href="/checkout" style={{ background: P, color: '#fff', display: 'inline-block', fontSize: 15, fontWeight: 900, padding: '14px 28px', borderRadius: 12, textDecoration: 'none' }}>
              اشترِ الآن — {settings.product_price} د.ك
            </Link>
          </div>
        </div>
      </main>
      <Footer settings={settings} />
    </PageShell>
  )
}
