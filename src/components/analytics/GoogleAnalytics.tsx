'use client'

// Loads gtag.js globally (root layout only — see src/app/layout.tsx) and
// tracks page_view on every App Router navigation, including client-side
// transitions (gtag's own history-based auto page_view only fires for full
// page loads unless Enhanced Measurement's SPA tracking is verified on in
// the GA4 property, which can't be guaranteed here) — so page_view is sent
// manually and `send_page_view: false` disables the automatic firing to
// avoid a duplicate on first load.
import Script from 'next/script'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GA_MEASUREMENT_ID, pageview } from '@/lib/gtag'

// useSearchParams() opts any component that calls it into client-side
// rendering unless wrapped in its own Suspense boundary — isolated here so
// it can never affect how the rest of the app (or this component's Script
// tags) render.
function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    pageview(query ? `${pathname}?${query}` : pathname)
  }, [pathname, searchParams])

  return null
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      {/* beforeInteractive (not afterInteractive) is deliberate: this defines
          window.gtag as a synchronous queuing shim — the same pattern
          Google's own GA4 snippet uses — BEFORE hydration, so it exists no
          matter how fast a page's own effects fire (e.g. /success calling
          trackPurchase the instant its API response resolves). Every
          gtag(...) call just pushes onto dataLayer; the external gtag.js
          script below drains that queue once it finishes loading. Without
          this, an event fired before the (async, afterInteractive) library
          script finishes loading would silently no-op instead of queuing —
          confirmed by testing: /success's purchase event was dropped this
          way when both scripts used afterInteractive. */}
      <Script id="ga4-init" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  )
}
