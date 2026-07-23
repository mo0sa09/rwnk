import { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rwnk.co'
  return [
    { url: base,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: `${base}/checkout`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/faq`,     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/about`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`,   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/refund`,  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/login`,   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
