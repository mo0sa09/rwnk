import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Admin-only file uploads (logo, favicon, homepage/OG images, product cover,
// product PDF). "Only admins can upload" is enforced by requireAdmin() below
// rather than Storage RLS — every write here goes through the service-role
// client (same pattern as the rest of /api/admin/*), so there is no
// client-writable path to either bucket.
const KINDS = {
  logo:      { bucket: 'site-assets', prefix: 'branding',  public: true,  maxMB: 2, types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] },
  favicon:   { bucket: 'site-assets', prefix: 'branding',  public: true,  maxMB: 1, types: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'] },
  og:        { bucket: 'site-assets', prefix: 'seo',       public: true,  maxMB: 3, types: ['image/png', 'image/jpeg', 'image/webp'] },
  image:     { bucket: 'site-assets', prefix: 'content',   public: true,  maxMB: 4, types: ['image/png', 'image/jpeg', 'image/webp'] },
  'product-pdf': { bucket: 'products', prefix: 'books',    public: false, maxMB: 50, types: ['application/pdf'] },
} as const
type Kind = keyof typeof KINDS

export async function POST(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const form = await request.formData()
  const file = form.get('file')
  const kind = form.get('kind') as Kind | null

  if (!(file instanceof File)) return NextResponse.json({ error: 'ملف مفقود' }, { status: 400 })
  if (!kind || !(kind in KINDS)) return NextResponse.json({ error: 'نوع الملف غير معروف' }, { status: 400 })

  const spec = KINDS[kind]
  if (file.size > spec.maxMB * 1024 * 1024) {
    return NextResponse.json({ error: `الحجم الأقصى المسموح ${spec.maxMB}MB` }, { status: 400 })
  }
  if (!(spec.types as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'صيغة الملف غير مدعومة' }, { status: 400 })
  }

  const sb = getAdminDb()
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${spec.prefix}/${kind}-${Date.now()}.${ext}`

  const { error: upErr } = await sb.storage.from(spec.bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  if (spec.public) {
    const { data } = sb.storage.from(spec.bucket).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path })
  }

  // Private bucket (product PDF) — no public URL; callers store `path` and
  // resolve a signed URL at download time, same as the existing download flow.
  return NextResponse.json({ path })
}
