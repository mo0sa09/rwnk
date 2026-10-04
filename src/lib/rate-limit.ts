// In-memory, per-process sliding-window limiter — good enough for this
// app's scale (no Redis/KV configured). Does NOT survive a cold start or
// coordinate across multiple serverless instances; it exists to blunt
// casual token-guessing/spam on the public admin-invite endpoints, not as a
// hard security boundary — the real boundary is the invitation token's own
// entropy (256 random bits) and the admin-only gate on the invite-creation
// endpoint itself.
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
