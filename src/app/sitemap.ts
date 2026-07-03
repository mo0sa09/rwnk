import { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rwnk.co'
  return [
    { url: base,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: `${base}/checkout`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/login`,   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
