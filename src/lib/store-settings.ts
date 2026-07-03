// Store settings — fetched from Supabase, cached
// Admin can edit these from the dashboard

export interface StoreSettings {
  store_name:       string
  store_tagline:    string
  product_name:     string
  product_price:    number
  product_currency: string
  product_id:       string
  whatsapp:         string
  email:            string
  instagram:        string
  twitter:          string
  primary_color:    string
  downloads_limit:  number
}

export const DEFAULT_SETTINGS: StoreSettings = {
  store_name:       'رَوْنَق',
  store_tagline:    'دليل التنظيف الاحترافي',
  product_name:     'كتاب رَوْنَق — دليل التنظيف الاحترافي',
  product_price:    15,
  product_currency: 'KWD',
  product_id:       'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  whatsapp:         '+96500000000',
  email:            'hello@rwnk.co',
  instagram:        '@rwnak.official',
  twitter:          '@rwnk',
  primary_color:    '#6747B2',
  downloads_limit:  5,
}

let _cache: StoreSettings | null = null

export async function getStoreSettings(): Promise<StoreSettings> {
  if (_cache) return _cache
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    ) as any
    const { data } = await sb.from('store_settings').select('*').single()
    if (data) { _cache = { ...DEFAULT_SETTINGS, ...data }; return _cache! }
  } catch {}
  return DEFAULT_SETTINGS
}

export function clearSettingsCache() { _cache = null }
