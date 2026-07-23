import type { Metadata } from 'next'
import { getPage, pageMetadata } from '@/lib/content'
import { getStoreSettings } from '@/lib/store-settings'
import { LegalPage } from '@/components/sections/LegalPage'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getPage('privacy'))
}

export default async function PrivacyPage() {
  const [page, settings] = await Promise.all([getPage('privacy'), getStoreSettings()])
  return <LegalPage page={page} settings={settings} />
}
