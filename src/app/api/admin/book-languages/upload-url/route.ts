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
// Every return path below is wrapped so this route NEVER lets an uncaught
// exception fall through to Next's default error page (which renders HTML,
// not JSON) — a client that gets HTML back from fetch() throws on
// res.json() and shows a useless generic error instead of whatever actually
// broke. `success` is included alongside `error`/`data` per the diagnostic
// contract requested while chasing this bug; additive only, so it doesn't
// change what existing callers already check (`res.ok` / `json.error`).
export async function POST(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdmin(request)
    if (authErr) return authErr

    const body = await request.json().catch(() => null)
    const languageCode = normalizeLanguageCode(body?.languageCode)
    const fileName = typeof body?.fileName === 'string' ? body.fileName : ''
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : 0
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''

    if (!BOOK_LANGUAGE_CODE_RE.test(languageCode)) {
      return NextResponse.json({ success: false, error: 'رمز اللغة غير صالح' }, { status: 400 })
    }
    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'صيغة الملف يجب أن تكون PDF فقط' }, { status: 400 })
    }
    if (!fileSize || fileSize > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `الحجم الأقصى المسموح ${MAX_MB}MB` }, { status: 400 })
    }

    // Same path convention as the old server-proxied route: books/{code}/....
    // A timestamp suffix (not a fixed filename) means "replace" never
    // overwrites a file an earlier request may still be mid-download from.
    const ext = fileName.split('.').pop() || 'pdf'
    const path = `books/${languageCode}/book-pdf-${Date.now()}.${ext}`

    const sb = getAdminDb()
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) {
      console.error(`[admin/book-languages/upload-url] createSignedUploadUrl failed: ${error.message}`, error)
      return NextResponse.json({ success: false, error: `تعذّر تحضير الرفع: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, path: data.path, token: data.token })
  } catch (err: any) {
    console.error('[admin/book-languages/upload-url] unhandled exception:', err)
    return NextResponse.json({ success: false, error: err?.message ?? 'خطأ غير متوقع في الخادم' }, { status: 500 })
  }
}
