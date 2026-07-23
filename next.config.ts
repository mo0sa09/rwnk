import type { NextConfig } from "next";

// Admin can set an arbitrary product image URL (src/components/admin/ContentTab.tsx
// -> store_settings.product_image_url), rendered with next/image on the landing
// page (src/app/page.tsx). Without a matching remotePattern, next/image throws
// at request time for any non-local hostname. Supabase Storage public URLs are
// the expected case; the project's own storage host is derived from
// NEXT_PUBLIC_SUPABASE_URL so it works without extra config.
let supabaseHostname: string | undefined
try {
  supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined
} catch {
  supabaseHostname = undefined
}

const nextConfig: NextConfig = {
  // A lockfile in a parent folder (outside this repo) made Next guess the
  // wrong workspace root. Pin it explicitly to this project.
  // A lockfile in a parent folder (outside this repo) made Next guess the
  // wrong workspace root. Pin it explicitly to this project.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{ protocol: 'https' as const, hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
        : []),
      { protocol: 'https' as const, hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
