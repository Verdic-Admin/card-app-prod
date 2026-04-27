import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Basic admin auth — same pattern as the rest of the admin API
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin_auth')?.value
  if (!adminAuth) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || ''
  ).replace(/\/$/, '')

  const url = siteUrl
    ? `${siteUrl}/api/cron/auction-finisher`
    : '/api/cron/auction-finisher'

  const secret = process.env.CRON_SECRET || null

  return NextResponse.json({ url, secret })
}
