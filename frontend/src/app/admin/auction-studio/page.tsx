import { sql } from '@vercel/postgres';
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LiveAuctionStudio } from '@/components/admin/LiveAuctionStudio'


export const dynamic = 'force-dynamic'

export default async function AuctionStudioPage() {
  const { rows: inventory } = await sql`SELECT * FROM inventory ORDER BY player_name ASC`;

  // Fetch Oracle discount percentage and stream settings
  const { rows: storeRows } = await sql`SELECT live_stream_url, projection_timeframe FROM store_settings WHERE id = 1`;
  const settings = storeRows[0] || {};

  const liveStreamUrl = settings?.live_stream_url || null
  const projectionTimeframe = settings?.projection_timeframe || '90-Day'

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin" className="text-slate-400 hover:text-indigo-600 font-bold transition-colors">
              ← Back to Admin
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
            Live Auction Studio
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage streams, stage pending block inventory, and go live.</p>
        </div>
      </div>

      <div className="flex flex-col space-y-10">
        <LiveAuctionStudio 
          initialItems={inventory || []} 
          initialStreamUrl={liveStreamUrl} 
          initialProjectionTimeframe={projectionTimeframe}
        />
      </div>
    </div>
  )
}
