import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { BOOK_LANGUAGE_CODE_RE, normalizeLanguageCode } from '@/lib/book-language-validation'

const MAX_MB = 50
const BUCKET = 'products'

// Issues a short-lived Supabase Storage signed upload URL so the browser can
// PUT the PDF directly to Storage instead of routing the whole file through
// this Next.js server. The generic /api/admin/upload proxies the entire file
// through a serverless function body — Vercel caps that at ~4.5MB regardless
// of the 50MB limit this feature advertises, which is why uploading a new
// book-language PDF failed with a non-JSON response (Vercel's own payload-
// too-large rejection, not our code, which never ran). This route only ever
// hands out a token scoped to one admin-chosen path; the actual bytes never
// touch our server, and the bucket stays private — see BookLanguagesTab.tsx
// for the client side of this flow.
export async function POST(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const body = await request.json().catch(() => null)
  const languageCode = normalizeLanguageCode(body?.languageCode)
  const fileName = typeof body?.fileName === 'string' ? body.fileName : ''
  const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : 0
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''

  if (!BOOK_LANGUAGE_CODE_RE.test(languageCode)) {
    return NextResponse.json({ error: 'رمز اللغة غير صالح' }, { status: 400 })
  }
  if (mimeType !== 'application/pdf') {
    return NextResponse.json({ error: 'صيغة الملف يجب أن تكون PDF فقط' }, { status: 400 })
  }
  if (!fileSize || fileSize > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `الحجم الأقصى المسموح ${MAX_MB}MB` }, { status: 400 })
  }

  // Same path convention as the old server-proxied route: books/{code}/....
  // A timestamp suffix (not a fixed filename) means "replace" never
  // overwrites a file an earlier request may still be mid-download from.
  const ext = fileName.split('.').pop() || 'pdf'
  const path = `books/${languageCode}/book-pdf-${Date.now()}.${ext}`

  const sb = getAdminDb()
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) {
    console.error(`[admin/book-languages/upload-url] createSignedUploadUrl failed: ${error.message}`)
    return NextResponse.json({ error: 'تعذّر تحضير الرفع، حاولي لاحقاً' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
