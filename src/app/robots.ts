import { MetadataRoute } from 'next'
import { getAppOrigin } from '@/utils/app-origin'

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin()
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
      }
    ],
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  }
}
