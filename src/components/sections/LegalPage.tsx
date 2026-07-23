import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PageShell } from '@/components/ui/PageShell'
import type { PageContent } from '@/types'
import type { StoreSettings } from '@/lib/store-settings'

const T1 = '#1A1228', T2 = '#4A4060'

export function LegalPage({ page, settings }: { page: PageContent; settings: StoreSettings }) {
  const paragraphs = page.content.split(/\n\n+/)
  return (
    <PageShell>
      <Navbar />
      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 clamp(20px,6vw,40px)' }}>
          <h1 style={{ fontSize: 'clamp(24px,5.5vw,34px)', fontWeight: 900, letterSpacing: -0.8, marginBottom: 28, color: T1 }}>{page.title}</h1>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 15, color: T2, lineHeight: 1.9, marginBottom: 18 }}>{p}</p>
          ))}
        </div>
      </main>
      <Footer settings={settings} />
    </PageShell>
  )
}
