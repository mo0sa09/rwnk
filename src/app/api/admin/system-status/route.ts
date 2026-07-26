import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseServerEnv } from '@/lib/env'

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

  return NextResponse.json({
    data: {
      supabaseConnected: !!(url && key),
      paymentGateway: gateway,
      paymentGatewayKeyConfigured: gatewayKeyConfigured,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    },
  })
}
