import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/admin-db'

// Cancels ("إلغاء الدعوة") a pending invitation — marks it revoked rather
// than deleting the row, so there's a record it existed. A revoked
// invitation's token immediately stops working at /api/admin/invite/accept
// (that route checks revoked_at IS NULL).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error: authErr } = await requireAdmin(request, ['super_admin'])
  if (authErr) return authErr

  const sb = getAdminDb()
  const { data, error } = await sb.from('admin_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id).is('accepted_at', null)
    .select('id').maybeSingle()

  if (error) {
    console.error(`[admin/staff/invitations/${id}] revoke failed: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'الدعوة غير موجودة أو تم قبولها مسبقاً' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
