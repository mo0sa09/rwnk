// Post-payment account provisioning — turns a `completed` purchase into an
// actually-accessible library entry for the customer, with NO manual
// "create a password" step required (guest checkout never asks for one).
//
// Split out from /api/payment/callback so the create-vs-link decision and
// the magic-link minting are independently testable/reviewable, and so the
// exact same logic runs from both the browser-redirect (GET) and webhook
// (POST) paths in the callback route — a customer landing back from
// MyFatoorah and an async webhook confirming the same purchase must produce
// an identical, idempotent result.

export interface EnsureUserLinkedResult {
  userId: string
  email: string
  isNewUser: boolean
}

// Deliberately does NOT use auth.admin.generateLink's documented (but, per
// a known upstream Supabase/GoTrue issue, occasionally flaky) "auto-create
// the user if the magiclink email doesn't exist yet" behavior — this is a
// money path, so the create-vs-exists decision is made explicitly and
// deterministically here via createUser(), with the SAME
// "try create, on already-registered fall back to lookup-by-email" pattern
// already used by createAccountAfterPurchase()/link-existing-purchase for
// the manual password-based flow. Idempotent: if the purchase already has a
// user_id (e.g. this is a retried/duplicate callback), it's returned as-is
// with no auth API calls at all.
export async function ensureUserLinked(
  sb: any,
  purchase: { id: string; user_id: string | null; email: string; guest_email?: string | null }
): Promise<EnsureUserLinkedResult | null> {
  const email = purchase.email ?? purchase.guest_email
  if (!email) {
    console.error(`[payment/access] purchase ${purchase.id} has no email on file — cannot create or link an account`)
    return null
  }

  if (purchase.user_id) {
    console.log(`[payment/access] purchase ${purchase.id} already linked to user ${purchase.user_id} — skipping account provisioning`)
    return { userId: purchase.user_id, email, isNewUser: false }
  }

  console.log(`[payment/access] purchase ${purchase.id} has no user_id yet — provisioning account for ${email}`)

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: true, // paid customer — email is already proven deliverable via the checkout flow, no confirmation click needed to unblock their own purchase
    user_metadata: { source: 'purchase', purchase_id: purchase.id },
  })

  let userId: string | null = null
  let isNewUser = false

  if (createErr) {
    const msg = (createErr.message ?? '').toLowerCase()
    const alreadyExists = msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')
    if (!alreadyExists) {
      console.error(`[payment/access] purchase ${purchase.id} — auth.admin.createUser failed for ${email}: ${createErr.message}`)
      return null
    }
    console.log(`[payment/access] purchase ${purchase.id} — ${email} already has an account, looking it up to link this purchase (repeat customer)`)
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) {
        if (error) console.error(`[payment/access] purchase ${purchase.id} — listUsers page ${page} failed: ${error.message}`)
        break
      }
      const found = data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (found) userId = found.id
      if (data.users.length < 1000) break
    }
    if (!userId) {
      console.error(`[payment/access] purchase ${purchase.id} — createUser said "already registered" but no matching account was found for ${email} via listUsers`)
      return null
    }
  } else {
    userId = created.user.id
    isNewUser = true
    console.log(`[payment/access] purchase ${purchase.id} — created new account ${userId} for ${email}`)
  }

  const { error: linkErr } = await sb.from('purchases')
    .update({ user_id: userId, account_created: true })
    .eq('id', purchase.id)

  if (linkErr) {
    console.error(`[payment/access] purchase ${purchase.id} — failed to write user_id=${userId}: ${linkErr.message}`)
    return null
  }

  console.log(`[payment/access] purchase ${purchase.id} linked to ${isNewUser ? 'new' : 'existing'} account ${userId} — will now appear in their library`)
  return { userId: userId as string, email, isNewUser }
}

// Mints a one-time sign-in link for a browser that just landed back from the
// gateway, so it can be redirected straight through Supabase's own
// verification endpoint and land on /library already authenticated — reuses
// the exact same GoTrue link-verification mechanism (redirect_to → our
// existing /auth/callback?code=... route) that Google login and password
// reset already rely on in this codebase, so no new auth code path is
// introduced. Returns null (never throws) on any failure — the caller must
// fall back to a safe non-broken destination (/success) rather than losing
// the customer on a 500 after they've already been charged.
export async function generateLibraryMagicLink(sb: any, email: string, appUrl: string): Promise<string | null> {
  const redirectTo = `${appUrl}/auth/callback?next=/library`
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })
  if (error || !data?.properties?.action_link) {
    console.error(`[payment/access] generateLink(magiclink) failed for ${email}: ${error?.message ?? 'no action_link returned'}`)
    return null
  }
  console.log(`[payment/access] minted auto-login link for ${email} → redirect target ${redirectTo}`)
  return data.properties.action_link as string
}
