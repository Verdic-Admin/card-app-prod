import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

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
    return `https://player.twitch.tv/?channel=${channel}&parent=${process.env.NEXT_PUBLIC_SITE_DOMAIN || 'localhost'}`;
  }
  return url;
}

export default async function LiveAuctionPage() {
  const supabase = await createClient()

  const { data: settings } = await (supabase as any)
    .from('store_settings')
    .select('live_stream_url')
    .eq('id', 1)
    .single()

  const liveStreamUrl = settings?.live_stream_url
  const embedUrl = getEmbedUrl(liveStreamUrl)

  const { data: items } = await (supabase as any)
    .from('inventory')
    .select('*')
    .eq('is_auction', true)
    .eq('auction_status', 'live')
    .order('player_name', { ascending: true })

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
        <p className="text-zinc-400 font-medium">Watch the stream and place your bids.</p>
      </div>

      <div className="mb-12">
        {embedUrl ? (
          <div className="aspect-w-16 aspect-h-9 bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
            <iframe 
              src={embedUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full min-h-[400px] md:min-h-[600px]"
            ></iframe>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-800 shadow-xl">
            <div className="text-5xl mb-4">📺</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Live Auction currently running.</h2>
            <p className="text-zinc-400">Next show is Sunday! Check back later.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-zinc-800 pb-2">Currently on the Block</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {(items || []).map((item: any) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl transform hover:-translate-y-1 transition-all duration-300">
              <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden">
                {item.is_verified_flip && item.video_url ? (
                  <>
                    <video 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-contain"
                      src={item.video_url}
                    ></video>
                    <div className="absolute top-2 left-2 bg-zinc-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-1 rounded shadow drop-shadow-md flex items-center gap-1 z-10">
                       PlayerIndex Certified ✓
                    </div>
                  </>
                ) : (
                  <img src={item.image_url} alt={item.player_name} className="w-full h-full object-contain" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg text-white leading-tight">{item.player_name}</h3>
                <p className="text-zinc-400 text-sm mb-3">{item.card_set}</p>
                <div className="text-center font-mono font-black text-2xl text-cyan-400 bg-zinc-950 py-2 rounded mb-4 shadow-inner">
                  ${item.current_bid || item.listed_price || '0.00'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => alert('Cash bidding coming soon!')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg">
                    Bid Cash
                  </button>
                  <button onClick={() => alert('Trade offers coming soon!')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-2 rounded text-sm transition-colors shadow-lg">
                    Offer Trade
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!items || items.length === 0 ? (
             <div className="col-span-full text-zinc-500 text-center py-10 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
               No items currently live on the block.
             </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
