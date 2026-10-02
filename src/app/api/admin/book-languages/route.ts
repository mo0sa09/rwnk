import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { isMissingTableError, missingTableMessage } from '@/lib/db-resilience'
import { BOOK_LANGUAGE_CODE_RE, normalizeLanguageCode, parseBookLanguagePayload } from '@/lib/book-language-validation'

export async function GET(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const sb = getAdminDb()
  const { data, error } = await sb.from('book_languages').select('*').order('sort_order', { ascending: true })
  if (error) {
    if (isMissingTableError(error)) {
      console.error('[admin/book-languages] table does not exist — pending migration in supabase/schema.sql §18 has not been applied.')
      return NextResponse.json({ data: [], migrationRequired: true, error: missingTableMessage('book_languages') })
    }
    console.error(`[admin/book-languages] failed to load: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const body = await request.json().catch(() => null)
  const languageCode = normalizeLanguageCode(body?.language_code)
  if (!BOOK_LANGUAGE_CODE_RE.test(languageCode)) {
    return NextResponse.json({ error: 'رمز اللغة يجب أن يكون حروفاً إنجليزية صغيرة فقط (2-10 أحرف)، مثال: fr' }, { status: 400 })
  }
  const payload = parseBookLanguagePayload(body)
  if (!payload) {
    return NextResponse.json({ error: 'الاسم بالعربية والإنجليزية مطلوبان' }, { status: 400 })
  }
  if (payload.is_active && !payload.file_path) {
    return NextResponse.json({ error: 'لا يمكن تفعيل لغة بدون رفع ملف PDF أولاً' }, { status: 400 })
  }

  const sb = getAdminDb()
  const { data, error } = await sb.from('book_languages').insert({ language_code: languageCode, ...payload }).select().single()
  if (error) {
    if (isMissingTableError(error)) {
      console.error('[admin/book-languages] cannot create — table does not exist — pending migration in supabase/schema.sql §18 has not been applied.')
      return NextResponse.json({ error: missingTableMessage('book_languages'), migrationRequired: true }, { status: 503 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: `رمز اللغة "${languageCode}" مستخدم مسبقاً` }, { status: 409 })
    }
    console.error(`[admin/book-languages] failed to create: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[admin/book-languages] created language_code=${languageCode} is_active=${payload.is_active}`)
  revalidatePath('/checkout')
  return NextResponse.json({ data })
}
