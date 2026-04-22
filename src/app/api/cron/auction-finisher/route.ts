import pool from '@/utils/db';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { price } from '@/utils/math';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log("-> Running Auction Finisher Cron...");

    const { rows: expiredItems } = await pool.query(`
      SELECT id, current_bid, auction_reserve_price 
      FROM inventory 
      WHERE is_auction = true 
        AND auction_status = 'live' 
        AND auction_end_time < NOW()
    `);

    if (!expiredItems || expiredItems.length === 0) {
      return NextResponse.json({ success: true, message: 'No expired auctions to process.' });
    }

    let soldCount = 0;
    let failedCount = 0;

    for (const item of expiredItems) {
       const reserve = price(item.auction_reserve_price);
       const bid = price(item.current_bid);

       if (bid >= reserve) {
          // Reserve met
          await pool.query(`
            UPDATE inventory 
            SET status = 'sold',
                listed_price = $1,
                auction_status = 'ended'
            WHERE id = $2
          `, [bid, item.id]);
          soldCount++;
       } else {
          // Reserve not met
          await pool.query(`
            UPDATE inventory 
            SET is_auction = false,
                auction_status = 'ended',
                status = 'available'
            WHERE id = $1
          `, [item.id]);
          failedCount++;
       }
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/auction');

    return NextResponse.json({ 
      success: true, 
      processed: expiredItems.length,
      sold: soldCount,
      failed_reserve: failedCount 
    });

  } catch (error: any) {
    console.error("Auction Finisher Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
