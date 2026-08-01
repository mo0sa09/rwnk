import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

// Force per-request rendering so admin edits to this page's content/store
// settings are never stuck behind a stale build-time snapshot — see the
// detailed comment on this same export in src/app/page.tsx.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('about'))
}

export default async function AboutPage() {
  const [page, settings] = await Promise.all([getPage('about'), getStoreSettings()])
  return <LegalPage page={page} settings={settings} />
}
