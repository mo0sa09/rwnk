// Store settings — fetched from Supabase, cached
// Admin can edit these from the dashboard

export interface StatItem { value: string; label: string }

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

  // Content — editable from Admin ▸ Content
  product_description:   string
  product_image_url:     string | null
  hero_badge:             string
  hero_title:              string
  hero_subtitle:           string
  hero_cta_text:           string
  pricing_cta_text:        string
  final_cta_title:         string
  final_cta_subtitle:      string
  final_cta_button_text:   string
  footer_cta_title:        string
  footer_cta_subtitle:     string
  stats_visible:           boolean
  stats:                   StatItem[]
  testimonials_visible:    boolean
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

  product_description:  'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف — بمعايير خمس نجوم.',
  product_image_url:    null,
  hero_badge:            'الإصدار الأول — متاح الآن',
  hero_title:             'منزلك يستحق *مستوى* الفنادق الراقية',
  hero_subtitle:          'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف — بمعايير خمس نجوم.',
  hero_cta_text:          'اشترِ الآن',
  pricing_cta_text:       'اشترِ الآن وحمّلي فوراً',
  final_cta_title:        'ابدئي رحلتك نحو منزل بمستوى الفنادق اليوم',
  final_cta_subtitle:     'انضمي إلى +500 عائلة اختارت رَوْنَق نظاماً لمنازلها',
  final_cta_button_text:  'اشترِ الآن',
  footer_cta_title:       'ابدئي بتحويل منزلك اليوم',
  footer_cta_subtitle:    'دليل تنظيف احترافي بمعايير 5 نجوم — تحميل فوري',
  stats_visible:          false,
  stats: [
    { value: '+500',   label: 'نسخة مُباعة' },
    { value: '4.9',    label: 'متوسط التقييم' },
    { value: '7 أيام', label: 'ضمان استرجاع' },
    { value: '5',      label: 'نجوم معيار' },
  ],
  testimonials_visible: false,
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

// Parses "some *highlighted* text" into plain segments + a marked segment,
// so admin-edited copy can keep the accent-colored word without hardcoding structure.
export function splitHighlight(text: string): { pre: string; highlight: string | null; post: string } {
  const m = text.match(/^([\s\S]*?)\*([\s\S]+?)\*([\s\S]*)$/)
  if (!m) return { pre: text, highlight: null, post: '' }
  return { pre: m[1], highlight: m[2], post: m[3] }
}
