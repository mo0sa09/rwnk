import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'
import { RESOURCES, pickFields } from '@/lib/admin-resources'
import { isMissingTableError, missingTableMessage } from '@/lib/db-resilience'

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const sb = getAdminDb()
  let query = sb.from(config.table).select('*')
  if (config.orderColumn) query = query.order(config.orderColumn, { ascending: true })
  const { data, error: dbErr } = await query
  if (dbErr) {
    // A live audit found this table may not exist at all — the CMS
    // migration in supabase/schema.sql was never run against production.
    // Return an empty list with the reason attached instead of a raw
    // PostgREST "relation does not exist" that reads like a server bug.
    if (isMissingTableError(dbErr)) {
      console.error(`[admin/${resource}] table '${config.table}' does not exist — pending migration in supabase/schema.sql has not been applied.`)
      return NextResponse.json({ data: [], migrationRequired: true, error: missingTableMessage(config.table) })
    }
    console.error(`[admin/${resource}] failed to load: ${dbErr.message}`)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const config = RESOURCES[resource]
  if (!config) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 })

  const { error } = await requireAdmin(request)
  if (error) return error

  const body = await request.json()
  const payload = pickFields(body, config.fields)

  const sb = getAdminDb()
  const { data, error: dbErr } = await sb.from(config.table).insert(payload).select().single()
  if (dbErr) {
    if (isMissingTableError(dbErr)) {
      console.error(`[admin/${resource}] cannot create — table '${config.table}' does not exist — pending migration in supabase/schema.sql has not been applied.`)
      return NextResponse.json({ error: missingTableMessage(config.table), migrationRequired: true }, { status: 503 })
    }
    console.error(`[admin/${resource}] failed to create: ${dbErr.message}`)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  revalidatePath('/')
  revalidatePath('/faq')
  return NextResponse.json({ data })
}
