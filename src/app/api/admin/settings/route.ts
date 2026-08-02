import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { STORE_SETTINGS_FIELDS, pickFields } from '@/lib/admin-resources'
import { DEFAULT_SETTINGS } from '@/lib/store-settings'
import { updateWithSchemaFallback, getSingletonRow } from '@/lib/db-resilience'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  // store_settings must hold exactly one row, but nothing at the DB level
  // enforces that — a live incident found a migration re-run's seed INSERT
  // silently created a SECOND row (no real ON CONFLICT target), and every
  // bare .single() against this table then 500'd with PostgREST's "Cannot
  // coerce the result to a single JSON object" — breaking every admin
  // save. getSingletonRow tolerates an accidental duplicate (uses the most
  // recently updated row) instead of breaking the whole admin panel, and
  // logs loudly so the duplicate still gets noticed and cleaned up.
  const { data, error: dbErr } = await getSingletonRow<Record<string, unknown>>(sb, 'store_settings')
  if (dbErr) {
    console.error(`[admin/settings GET] ${dbErr.message}`)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
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
  const { data: existing, error: findErr } = await getSingletonRow<{ id: string }>(sb, 'store_settings', 'id')
  if (findErr || !existing) {
    console.error(`[admin/settings PATCH] could not resolve the store_settings row to update: ${findErr?.message ?? 'no row found'}`)
    return NextResponse.json({ error: findErr?.message ?? 'store_settings row not found' }, { status: 500 })
  }

  // A live audit found most of store_settings' later ALTER TABLE migrations
  // (hero_*, product_image_url, stats, logo_url, meta_*, etc. — 21 of 33
  // admin-editable fields) were never applied to production. Postgres
  // UPDATEs are atomic, so previously a SINGLE unknown column in this
  // payload silently failed the ENTIRE save — including fields like
  // store_name or product_price that DO exist and should have saved fine.
  // updateWithSchemaFallback saves everything that CAN be saved and reports
  // exactly what was dropped, instead of an all-or-nothing failure.
  const { data, error: dbErr, droppedFields } = await updateWithSchemaFallback(sb, 'store_settings', 'id', existing.id, payload)
  if (dbErr) {
    console.error(`[admin/settings] update failed: ${dbErr.message}${droppedFields.length ? ` (already dropped: ${droppedFields.join(', ')})` : ''}`)
    return NextResponse.json({ error: dbErr.message, droppedFields }, { status: 500 })
  }
  if (droppedFields.length > 0) {
    console.warn(`[admin/settings] saved, but these fields don't exist on the live database yet and were skipped: ${droppedFields.join(', ')} — run the pending migration (supabase/schema.sql) to enable them.`)
  }
  console.log(`[admin/settings] update succeeded — id=${existing.id} fields=${Object.keys(payload).join(',')}`)

  // Every public page reads store_settings server-side on each request, but
  // Next's full-route cache can still serve a pre-rendered copy of static
  // pages until told otherwise — this is what makes edits show up right away.
  // (The public pages themselves are ALSO now force-dynamic — see
  // src/app/page.tsx — so this is a secondary safety net, not the only
  // thing standing between an edit and it showing up live.)
  revalidatePath('/')
  revalidatePath('/checkout')
  revalidatePath('/faq')
  revalidatePath('/about')
  revalidatePath('/terms')
  revalidatePath('/privacy')
  revalidatePath('/refund')

  // droppedFields is always present (empty array when nothing was dropped)
  // so the admin UI can surface a precise "saved, but X/Y/Z need a database
  // update" message instead of a blanket success toast that overstates what
  // actually persisted.
  return NextResponse.json({ data, droppedFields })
}
