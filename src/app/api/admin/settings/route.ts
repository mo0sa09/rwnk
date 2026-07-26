import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { STORE_SETTINGS_FIELDS, pickFields } from '@/lib/admin-resources'
import { DEFAULT_SETTINGS } from '@/lib/store-settings'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from('store_settings').select('*').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  // Columns added by later migrations (stats, hero_image_url, etc.) may not
  // exist on the row yet if supabase/schema.sql hasn't been re-run — fall
  // back to defaults instead of shipping `undefined` into the admin form.
  return NextResponse.json({ data: { ...DEFAULT_SETTINGS, ...data } })
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, STORE_SETTINGS_FIELDS)

  const sb = getAdminDb()
  const { data: existing, error: findErr } = await sb.from('store_settings').select('id').single()
  if (findErr || !existing) return NextResponse.json({ error: findErr?.message ?? 'store_settings row not found' }, { status: 500 })

  const { data, error: dbErr } = await sb.from('store_settings').update(payload).eq('id', existing.id).select().single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Every public page reads store_settings server-side on each request, but
  // Next's full-route cache can still serve a pre-rendered copy of static
  // pages until told otherwise — this is what makes edits show up right away.
  revalidatePath('/')
  revalidatePath('/checkout')
  revalidatePath('/faq')
  revalidatePath('/about')
  revalidatePath('/terms')
  revalidatePath('/privacy')
  revalidatePath('/refund')

  return NextResponse.json({ data })
}
