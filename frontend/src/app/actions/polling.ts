'use server'

import { sql } from '@vercel/postgres'

export async function getLiveAuctionStatus() {
  const { rows } = await sql`
     SELECT id, current_bid, bidder_count 
     FROM inventory 
     WHERE is_auction = true AND auction_status = 'live'
  `;
  return rows;
}
