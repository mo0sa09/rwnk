// download_tokens has no client-writable INSERT policy by design — token
// creation always goes through the server (service role), which applies
// the real ownership + download-limit checks. See /api/download/token.
export async function generateDownloadTokenSafe(purchaseId: string): Promise<string> {
  const res = await fetch('/api/download/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : (json.error ?? 'ERROR'))
  return json.token
}
