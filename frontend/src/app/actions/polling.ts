"use server";

import pool from '@/utils/db';

export async function getLiveAuctionStatus() {
  const { rows } = await pool.query(`
     SELECT id, current_bid, bidder_count 
     FROM inventory 
     WHERE is_auction = true AND auction_status = 'live'
  `);
  return rows;
}
