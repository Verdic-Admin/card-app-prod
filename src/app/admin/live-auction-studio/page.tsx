import pool from '@/utils/db';
import { LiveStreamPresentation } from '@/components/admin/LiveStreamPresentation';

export const dynamic = 'force-dynamic'

export default async function LiveAuctionStudioPage() {
  // Fetch all items currently staged for the stream queue
  // Also fetch items that are part of lots, so we can display them together if a lot is selected
  const { rows: items } = await pool.query(
    `SELECT * FROM inventory 
     WHERE is_stream_queue = true
     ORDER BY player_name ASC`
  );

  const { rows: allChildren } = await pool.query(
    `SELECT * FROM inventory WHERE lot_id IS NOT NULL`
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <LiveStreamPresentation 
        initialItems={items as any} 
        allChildren={allChildren as any}
      />
    </div>
  )
}
