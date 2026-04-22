import pool from '@/utils/db';
import Link from 'next/link'
import { LiveAuctionGrid } from '@/components/LiveAuctionGrid';

export const dynamic = 'force-dynamic'

function getEmbedUrl(url: string | null) {
  if (!url) return null;
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('watch?v=', 'embed/');
  }
  if (url.includes('youtu.be/')) {
    return url.replace('youtu.be/', 'youtube.com/embed/');
  }
  if (url.includes('twitch.tv/')) {
    const channel = url.split('twitch.tv/')[1];
    let parentDomain = 'localhost';
    try {
      if (process.env.NEXT_PUBLIC_SITE_URL) {
         parentDomain = new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname;
      }
    } catch(e) {}
    return `https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}`;
  }
  return url;
}

export default async function LiveAuctionPage() {
  const { rows: storeRows } = await pool.query(`SELECT live_stream_url FROM store_settings WHERE id = 1`);
  const settings = storeRows[0] || {};

  const liveStreamUrl = settings?.live_stream_url
  const embedUrl = getEmbedUrl(liveStreamUrl)

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

      <div className="mb-12">
        {embedUrl ? (
          <div className="aspect-w-16 aspect-h-9 bg-surface rounded-2xl overflow-hidden shadow-2xl border border-border">
            <iframe 
              src={embedUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full min-h-[400px] md:min-h-[600px]"
            ></iframe>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl p-12 text-center border border-border shadow-xl">
            <div className="text-5xl mb-4">📺</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Live Auction currently running.</h2>
            <p className="text-muted">Next show is Sunday! Check back later.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-border pb-2">Currently on the Block</h2>
        <LiveAuctionGrid initialItems={items as any} />
      </div>
    </div>
  )
}
