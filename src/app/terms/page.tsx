import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('terms'))
}

export default async function TermsPage() {
  const [page, settings] = await Promise.all([getPage('terms'), getStoreSettings()])
  return <LegalPage page={page} settings={settings} />
}
