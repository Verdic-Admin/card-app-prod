import pool from '@/utils/db';
import { LiveAuctionGrid } from '@/components/LiveAuctionGrid';
import { AsyncAuctionGrid } from '@/components/AsyncAuctionGrid';

export const dynamic = 'force-dynamic'

export default async function AuctionPage() {
  // Tier 1: "On The Block" — live items with real-time bidding
  const { rows: liveItems } = await pool.query(
    `SELECT * FROM inventory WHERE is_auction = true AND auction_status = 'live' ORDER BY player_name ASC`
  );

  // Tier 2: "24/7 Auctions" — async items with countdown timers (end time in the future)
  const { rows: asyncItems } = await pool.query(
    `SELECT * FROM inventory WHERE is_auction = true AND auction_status = 'live' AND auction_end_time > NOW() ORDER BY auction_end_time ASC`
  );

  // Separate: live items WITHOUT an end time = real-time stream-style
  const realTimeLive = liveItems.filter((i: any) => !i.auction_end_time || new Date(i.auction_end_time) <= new Date());
  // Items with future end times go to the async tier
  const timedAuctions = asyncItems;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Tier 1: On The Block */}
      <div className="mb-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center justify-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
            On The Block
          </h1>
          <p className="text-zinc-400 text-sm font-medium">Real-time bidding — updates every 3 seconds</p>
        </div>
        <LiveAuctionGrid initialItems={realTimeLive as any} />
      </div>

      {/* Tier 2: 24/7 Auctions */}
      {timedAuctions.length > 0 && (
        <div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1 border-b border-border pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              24/7 Auctions
            </h2>
            <p className="text-zinc-400 text-sm font-medium mt-2">Bid anytime — countdown timers close automatically</p>
          </div>
          <AsyncAuctionGrid initialItems={timedAuctions as any} />
        </div>
      )}

      {liveItems.length === 0 && timedAuctions.length === 0 && (
        <div className="text-center py-20">
          <div className="text-zinc-600 text-6xl mb-4">🔨</div>
          <h2 className="text-xl font-bold text-zinc-400 mb-2">No active auctions right now</h2>
          <p className="text-zinc-500 text-sm">Check back soon — the shop owner drops new listings regularly.</p>
        </div>
      )}
    </div>
  )
}
