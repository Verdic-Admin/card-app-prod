import pool from '@/utils/db';
import { LiveAuctionGrid } from '@/components/LiveAuctionGrid';

export const dynamic = 'force-dynamic'

export default async function LiveAuctionPage() {
  const { rows: items } = await pool.query(`SELECT * FROM inventory WHERE is_auction = true AND auction_status = 'live' ORDER BY player_name ASC`);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center justify-center gap-3">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
          Live Auctions
        </h1>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-border pb-2">Currently on the Block</h2>
        <LiveAuctionGrid initialItems={items as any} />
      </div>
    </div>
  )
}
