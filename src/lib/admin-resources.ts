// Allowlist for the generic /api/admin/[resource] CRUD route.
// Keeps writes scoped to known tables/columns even though the handler
// uses the service-role client (which bypasses RLS).

export interface ResourceConfig {
  table: string
  idColumn: string
  fields: string[]
  orderColumn: string | null
}

export const RESOURCES: Record<string, ResourceConfig> = {
  testimonials: {
    table: 'testimonials', idColumn: 'id', orderColumn: 'sort_order',
    fields: ['name', 'location', 'image_url', 'rating', 'review_text', 'sort_order', 'is_active'],
  },
  faqs: {
    table: 'faqs', idColumn: 'id', orderColumn: 'sort_order',
    fields: ['question', 'answer', 'sort_order', 'is_active'],
  },
  features: {
    table: 'features', idColumn: 'id', orderColumn: 'sort_order',
    fields: ['icon', 'title', 'description', 'sort_order', 'is_active'],
  },
  comparison_rows: {
    table: 'comparison_rows', idColumn: 'id', orderColumn: 'sort_order',
    fields: ['label', 'rwnk_has', 'others_has', 'sort_order', 'is_active'],
  },
  pages: {
    table: 'pages', idColumn: 'slug', orderColumn: null,
    fields: ['title', 'meta_description', 'content'],
  },
}

export const STORE_SETTINGS_FIELDS = [
  'store_name', 'store_tagline', 'product_name', 'product_price', 'product_currency',
  'whatsapp', 'email', 'instagram', 'twitter', 'primary_color', 'downloads_limit',
  'product_description', 'product_image_url',
  'hero_badge', 'hero_title', 'hero_subtitle', 'hero_cta_text', 'pricing_cta_text',
  'final_cta_title', 'final_cta_subtitle', 'final_cta_button_text',
  'footer_cta_title', 'footer_cta_subtitle',
  'stats_visible', 'stats', 'testimonials_visible',
]

export function pickFields<T extends Record<string, unknown>>(body: T, fields: string[]): Partial<T> {
  const out: Partial<T> = {}
  for (const key of fields) {
    if (key in body) out[key as keyof T] = body[key as keyof T]
  }
  return out
}
