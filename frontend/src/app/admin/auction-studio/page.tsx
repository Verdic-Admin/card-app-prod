import pool from '@/utils/db';
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LiveAuctionStudio } from '@/components/admin/LiveAuctionStudio'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'


export const dynamic = 'force-dynamic'

export default async function AuctionStudioPage() {
  const { rows: inventory } = await pool.query(`SELECT * FROM inventory ORDER BY player_name ASC`);

  // Fetch Oracle discount percentage and stream settings
  const { rows: storeRows } = await pool.query(`SELECT live_stream_url, projection_timeframe FROM store_settings WHERE id = 1`);
  const settings = storeRows[0] || {};

  const liveStreamUrl = settings?.live_stream_url || null
  const projectionTimeframe = settings?.projection_timeframe || '90-Day'

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin" className="text-muted hover:text-indigo-600 font-bold transition-colors">
              ← Back to Admin
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
            Live Auction Studio
              <InstructionTrigger 
                 title="Live Auction Setup Guide"
                 steps={[
                    { title: "Step 1: Configure Stream", content: "First, navigate to your 'Store Operations' settings and past your YouTube or Twitch Live URL. This synchronizes the Edge platform so buyers can view your stream directly alongside the bidding UI." },
                    { title: "Step 2: Staging the Block", content: "Identify which items from your inventory you plan to auction today. Switch their status to 'Pending Block'. This queues them up locally in this studio without immediately sending out push notifications." },
                    { title: "Step 3: Going Live", content: "Once on stream, you can 'Push' an item from your Pending Block to 'Active'. This instantly displays the specific card to all connected viewers and begins accepting real-time bids routed directly to your ledger." }
                 ]}
              />
          </h1>
          <p className="text-muted mt-1 font-medium">Manage streams, stage pending block inventory, and go live.</p>
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
