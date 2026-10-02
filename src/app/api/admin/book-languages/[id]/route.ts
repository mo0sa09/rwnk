import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { isMissingTableError, missingTableMessage } from '@/lib/db-resilience'
import { parseBookLanguagePatch } from '@/lib/book-language-validation'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const body = await request.json().catch(() => null)
  const patch = parseBookLanguagePatch(body)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'لا يوجد تغيير' }, { status: 400 })
  }

  const sb = getAdminDb()

  // Activating a language with no file (neither already on the row nor
  // provided in this same patch) would make it purchasable at checkout with
  // nothing for the download route to ever resolve — reject before writing,
  // same guard as creation.
  if (patch.is_active === true && patch.file_path === undefined) {
    const { data: existing, error: findErr } = await sb.from('book_languages').select('file_path').eq('id', id).single()
    if (findErr) {
      if (isMissingTableError(findErr)) return NextResponse.json({ error: missingTableMessage('book_languages'), migrationRequired: true }, { status: 503 })
      return NextResponse.json({ error: findErr.message }, { status: 404 })
    }
    if (!existing?.file_path) {
      return NextResponse.json({ error: 'لا يمكن تفعيل لغة بدون رفع ملف PDF أولاً' }, { status: 400 })
    }
  }
  if (patch.file_path === null && patch.is_active !== false) {
    // Clearing the file while leaving (or setting) is_active=true is the same
    // unsafe state as above — never allow it implicitly.
    return NextResponse.json({ error: 'لا يمكن إزالة الملف من لغة مفعّلة — عطّلي اللغة أولاً' }, { status: 400 })
  }

  const { data, error } = await sb.from('book_languages').update(patch).eq('id', id).select().single()
  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: missingTableMessage('book_languages'), migrationRequired: true }, { status: 503 })
    }
    console.error(`[admin/book-languages/${id}] update failed: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log(`[admin/book-languages/${id}] updated fields=${Object.keys(patch).join(',')}`)
  revalidatePath('/checkout')
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error: authErr } = await requireAdmin(request)
  if (authErr) return authErr

  const sb = getAdminDb()

  const { data: language, error: findErr } = await sb.from('book_languages').select('language_code').eq('id', id).single()
  if (findErr || !language) {
    if (findErr && isMissingTableError(findErr)) return NextResponse.json({ error: missingTableMessage('book_languages'), migrationRequired: true }, { status: 503 })
    return NextResponse.json({ error: 'اللغة غير موجودة' }, { status: 404 })
  }

  // Proactive, friendly check — §12 of the spec: a language with existing
  // purchases must never be hard-deleted, only disabled. The database's own
  // FK (purchases.book_language -> book_languages.language_code, ON DELETE
  // RESTRICT — see supabase/schema.sql §18.3) is the actual backstop against
  // this ever being bypassed by a future code change; this check just turns
  // that into a clear Arabic message instead of a raw constraint-violation
  // error surfacing to the admin UI.
  const { count, error: countErr } = await sb.from('purchases').select('id', { count: 'exact', head: true }).eq('book_language', language.language_code)
  if (countErr) {
    console.error(`[admin/book-languages/${id}] could not check existing purchases before delete: ${countErr.message} — refusing to delete`)
    return NextResponse.json({ error: 'تعذّر التحقق من الطلبات المرتبطة بهذه اللغة' }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({
      error: `لا يمكن حذف هذه اللغة — توجد ${count} عملية شراء مرتبطة بها. عطّليها بدلاً من حذفها.`,
      hasPurchases: true,
    }, { status: 409 })
  }

  const { error: delErr } = await sb.from('book_languages').delete().eq('id', id)
  if (delErr) {
    // Belt-and-suspenders: a purchase could theoretically be inserted between
    // the count check above and this delete. 23503 = Postgres foreign_key_violation.
    if ((delErr as any).code === '23503') {
      return NextResponse.json({ error: 'لا يمكن حذف هذه اللغة — توجد طلبات مرتبطة بها. عطّليها بدلاً من حذفها.', hasPurchases: true }, { status: 409 })
    }
    console.error(`[admin/book-languages/${id}] delete failed: ${delErr.message}`)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }
  console.log(`[admin/book-languages/${id}] deleted language_code=${language.language_code}`)
  revalidatePath('/checkout')
  return NextResponse.json({ ok: true })
}
