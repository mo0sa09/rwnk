// Store settings — fetched from Supabase, cached
// Admin can edit these from the dashboard

export interface StatItem { value: string; label: string }

export interface StoreSettings {
  store_name:       string
  store_tagline:    string
  product_name:     string
  product_price:    number
  product_original_price: number
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

  // Branding + SEO — editable from Admin ▸ Website Settings
  logo_url:         string | null
  favicon_url:      string | null
  meta_title:       string
  meta_description: string
  meta_keywords:    string
  og_image_url:     string | null
  hero_image_url:   string | null
}

export const DEFAULT_SETTINGS: StoreSettings = {
  store_name:       'رَوْنَق',
  store_tagline:    'دليل التنظيف الاحترافي',
  product_name:     'كتاب رَوْنَق — دليل التنظيف الاحترافي',
  product_price:    5,
  product_original_price: 7,
  product_currency: 'KWD',
  product_id:       'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  whatsapp:         '+96500000000',
  email:            'info@rwnak.net',
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
  final_cta_subtitle:     'ابدئي رحلتك نحو منزل بمستوى الفنادق مع رَوْنَق',
  final_cta_button_text:  'اشترِ الآن',
  footer_cta_title:       'ابدئي بتحويل منزلك اليوم',
  footer_cta_subtitle:    'دليل تنظيف احترافي بمعايير 5 نجوم — تحميل فوري',
  stats_visible:          false,
  stats: [
    { value: '٥',    label: 'فصول تدريبية' },
    { value: 'PDF',  label: 'تحميل فوري' },
    { value: 'KWD',  label: 'دفعة واحدة' },
    { value: '٢٤/٧', label: 'وصول دائم للدليل' },
  ],
  testimonials_visible: false,

  logo_url:         null,
  favicon_url:      null,
  meta_title:       'رَوْنَق — دليل التنظيف الاحترافي',
  meta_description: 'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف بمعايير الفنادق الخمس نجوم. تحميل فوري بعد الدفع.',
  meta_keywords:    'تنظيف منزلي, تدريب عاملات, دليل تنظيف, تنظيف احترافي, رونق, الكويت',
  og_image_url:     null,
  hero_image_url:   null,
}

// No module-level cache here on purpose: this used to memoize the result
// for the lifetime of the server process, so an admin edit in
// /api/admin/settings wouldn't show up on the public site until the next
// cold start — the opposite of "updates instantly from dashboard". Next's
// own per-request rendering plus revalidatePath() (called after every
// settings write) is what makes this fast/fresh instead.
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { getSingletonRow } = await import('./db-resilience')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    ) as any
    // store_settings must always have exactly one row, but a live incident
    // (a migration re-run's seed INSERT silently creating a second row)
    // proved a bare .single() here is a single point of failure for the
    // ENTIRE public site: it threw on every request, was swallowed by the
    // catch below, and every page silently rendered hardcoded defaults
    // instead of the real database content — with no error visible
    // anywhere. getSingletonRow tolerates that instead of crashing, and
    // logs loudly so a duplicate is caught immediately, not indefinitely.
    const { data, error } = await getSingletonRow<Partial<StoreSettings>>(sb, 'store_settings')
    if (error) console.error(`[getStoreSettings] ${error.message} — falling back to DEFAULT_SETTINGS.`)
    if (data) return { ...DEFAULT_SETTINGS, ...data }
  } catch (e) {
    console.error(`[getStoreSettings] unexpected error — falling back to DEFAULT_SETTINGS: ${e instanceof Error ? e.message : e}`)
  }
  return DEFAULT_SETTINGS
}

// Parses "some *highlighted* text" into plain segments + a marked segment,
// so admin-edited copy can keep the accent-colored word without hardcoding structure.
export function splitHighlight(text: string): { pre: string; highlight: string | null; post: string } {
  const m = text.match(/^([\s\S]*?)\*([\s\S]+?)\*([\s\S]*)$/)
  if (!m) return { pre: text, highlight: null, post: '' }
  return { pre: m[1], highlight: m[2], post: m[3] }
}
