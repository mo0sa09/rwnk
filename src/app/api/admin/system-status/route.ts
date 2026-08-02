import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseServerEnv } from '@/lib/env'
import { RESOURCES, STORE_SETTINGS_FIELDS } from '@/lib/admin-resources'
import { auditSchema, type ExpectedTable } from '@/lib/db-resilience'

// This endpoint's entire purpose is to report the CURRENT live database
// state — a cached answer is a wrong answer by definition (e.g. "5 tables
// missing" served for minutes after a migration that just fixed all 5).
// force-dynamic guarantees Next never statically optimizes this route, and
// the explicit Cache-Control header guarantees no browser, proxy, or CDN
// sitting in front of the deployed app caches the response either — the
// inner fetch to Supabase's own schema endpoint already uses cache:
// 'no-store' (see auditSchema in src/lib/db-resilience.ts), so every layer
// from the database read to the HTTP response is now non-cacheable.
export const dynamic = 'force-dynamic'

// Everything the codebase expects to read/write, independent of whether
// supabase/schema.sql's migrations for it have actually been applied. Kept
// here (not derived automatically) so this stays a deliberate, reviewable
// checklist of "what production needs" rather than silently tracking
// whatever the code happens to reference this week.
const EXPECTED_SCHEMA: ExpectedTable[] = [
  ...Object.values(RESOURCES).map(r => ({ table: r.table, columns: r.fields })),
  { table: 'store_settings', columns: STORE_SETTINGS_FIELDS },
  { table: 'products', columns: ['file_path', 'file_path_ar', 'file_path_en', 'version', 'version_ar', 'version_en'] },
  { table: 'purchases', columns: ['book_language', 'customer_name'] },
]

// Server-only env vars (PAYMENT_GATEWAY, MYFATOORAH_*, service role key) are
// never readable from a 'use client' component — process.env.PAYMENT_GATEWAY
// there always evaluates to undefined since it lacks the NEXT_PUBLIC_ prefix.
// The admin UI previously read it directly client-side and silently always
// showed the fallback default. This route reads it server-side instead.
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  const { url, key } = getSupabaseServerEnv()
  const gateway = process.env.PAYMENT_GATEWAY ?? 'myfatoorah'
  const gatewayKeyConfigured = gateway === 'tap' ? !!process.env.TAP_SECRET_KEY : !!process.env.MYFATOORAH_API_KEY
  const emailConfigured = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM

  const schema = url && key
    ? await auditSchema(url, key, EXPECTED_SCHEMA)
    : { reachable: false, missingTables: [], missingColumns: {}, error: 'Supabase env vars not configured' }

  const migrationRequired = schema.missingTables.length > 0 || Object.keys(schema.missingColumns).length > 0

  return NextResponse.json(
    {
      data: {
        supabaseConnected: !!(url && key),
        paymentGateway: gateway,
        paymentGatewayKeyConfigured: gatewayKeyConfigured,
        emailConfigured,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        schema: { ...schema, migrationRequired },
      },
    },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
