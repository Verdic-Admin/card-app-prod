import pool from '@/utils/db';
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LiveAuctionStudio } from '@/components/admin/LiveAuctionStudio'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'
import { price } from '@/utils/math'


export const dynamic = 'force-dynamic'

function normalizeInventoryMoneyFields<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    listed_price: row.listed_price == null ? null : price(row.listed_price),
    avg_price: row.avg_price == null ? null : price(row.avg_price),
    cost_basis: row.cost_basis == null ? null : price(row.cost_basis),
    current_bid: row.current_bid == null ? null : price(row.current_bid),
    auction_reserve_price: row.auction_reserve_price == null ? null : price(row.auction_reserve_price),
    oracle_projection: row.oracle_projection == null ? null : price(row.oracle_projection),
    oracle_trend_percentage: row.oracle_trend_percentage == null ? null : price(row.oracle_trend_percentage),
  };
}

export default async function AuctionStudioPage() {
  const { rows } = await pool.query(`SELECT * FROM inventory ORDER BY player_name ASC`);
  const inventory = (rows as Record<string, unknown>[]).map(normalizeInventoryMoneyFields);

  // Fetch auction studio settings
  const { rows: storeRows } = await pool.query(
    `SELECT projection_timeframe, auction_qr_url, oracle_discount_percentage FROM store_settings WHERE id = 1`,
  );
  const settings = storeRows[0] || {};

  const projectionTimeframe = settings?.projection_timeframe || '90-Day'
  const auctionQrUrl = settings?.auction_qr_url || null
  const discountRate = Number(settings?.oracle_discount_percentage ?? 0) || 0

  let auctionLeadByItemId: Record<string, { bidder_email: string; bid_amount: number }> = {}
  try {
    const { rows: leadRows } = await pool.query<{
      item_id: string
      bidder_email: string
      bid_amount: string | number
    }>(
      `SELECT DISTINCT ON (item_id)
         item_id::text AS item_id,
         bidder_email,
         bid_amount
       FROM auction_bids
       WHERE item_id IN (SELECT id FROM inventory WHERE is_auction = true)
       ORDER BY item_id, bid_amount::numeric DESC, created_at DESC`,
    )
    for (const r of leadRows) {
      auctionLeadByItemId[String(r.item_id)] = {
        bidder_email: r.bidder_email,
        bid_amount: price(r.bid_amount),
      }
    }
  } catch (e) {
    console.warn('[auction-studio] auction_bids high-bidder map skipped:', e)
  }

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
                    { title: "1. Add from inventory", content: "Search your inventory, check cards, set reserve and end time (optional session defaults), then Stage. Only one flow — no duplicate staging panels elsewhere." },
                    { title: "2. Staging + coin photo", content: "Each row shows store and PI pricing. Save reserve, attach a coin verification photo (Save row), then GO LIVE." },
                    { title: "3. Go live + bids", content: "Cards go live on the /auction page. Share the link on your social media streams (Facebook, Twitter, Instagram). Bidders use their social handles — no account required." }
                 ]}
              />
          </h1>
          <p className="text-muted mt-1 font-medium">Stage inventory, control live status, and manage your auctions.</p>
        </div>
      </div>

      <div className="flex flex-col space-y-10">
        <LiveAuctionStudio
          initialItems={inventory || []}
          initialProjectionTimeframe={projectionTimeframe}
          initialAuctionQrUrl={auctionQrUrl}
          discountRate={discountRate}
          auctionLeadByItemId={auctionLeadByItemId}
        />
      </div>
    </div>
  )
}
