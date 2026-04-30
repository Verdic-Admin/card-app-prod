import pool from '@/utils/db';
import { price as p } from '@/utils/math'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CardGrid } from '@/components/CardGrid'
import { ProductCard } from '@/components/ProductCard'
import { ItemDetailClient, ImageMagnifier } from '@/components/ItemDetailClient'
import { MarketSparkline } from '@/components/MarketSparkline'
import { getStoreSettings } from '@/app/actions/settings'
import { deriveDisplayPricing } from '@/utils/pricing'
import { buildPlayerIndexForecasterUrl } from '@/lib/player-index-deeplink'
import { PlayerIndexForecastLink } from '@/components/PlayerIndexForecastLink'
import { getAppOrigin } from '@/utils/app-origin'

type PageProps = { params: Promise<{ id: string }> }

/** Facebook / iMessage / Discord crawlers need absolute `og:image` URLs. */
function absoluteOgImageUrl(url: string | null | undefined): string | undefined {
  if (url == null || typeof url !== 'string') return undefined
  const t = url.trim()
  if (!t) return undefined
  if (/^https?:\/\//i.test(t)) return t
  const base = getAppOrigin()
  if (!base) return undefined
  return t.startsWith('/') ? `${base.replace(/\/$/, '')}${t}` : `${base.replace(/\/$/, '')}/${t}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  
  const { rows } = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [id]);
  const item = rows[0];

  if (!item) {
    return {
      title: 'Item Not Found | Sports Card Store',
      description: 'The requested sports card could not be found.',
    }
  }

  const isLiveAuction = Boolean(item.is_auction) && item.auction_status === 'live'
  const displayPrice = p(item.listed_price ?? item.avg_price).toFixed(2)
  const title = isLiveAuction
    ? `${item.player_name} - ${item.card_set || ''} | Live Auction`
    : `${item.player_name} - ${item.card_set || ''} | $${displayPrice}`
  
  let descriptionParts = []
  if (item.parallel_insert_type) descriptionParts.push(`Parallel/Insert: ${item.parallel_insert_type}`)
  if (item.team_name) descriptionParts.push(`Team: ${item.team_name}`)
  if (item.is_lot) descriptionParts.push(`📦 Lot Bundle`)
  
  const description = descriptionParts.length > 0 
    ? descriptionParts.join(' · ') 
    : 'View this card and more on our zero-fee storefront.'

  const absImage = absoluteOgImageUrl(item.image_url)
  const origin = getAppOrigin()
  const pageUrl = origin ? `${origin.replace(/\/$/, '')}/item/${id}` : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(pageUrl ? { url: pageUrl } : {}),
      ...(absImage
        ? {
            images: [
              {
                url: absImage,
                alt: `${item.player_name} — card photo`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(absImage ? { images: [absImage] } : {}),
    },
  }
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params
  const settings = await getStoreSettings()
  
  // ── Fetch the primary item ──────────────────────────────────────────────
  let item;
  let error;
  try {
     const { rows } = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [id]);
     item = rows[0];
  } catch(e) {
     error = e;
  }

  if (error || !item) return notFound()

  // ── LOT PAGE: render parent lot + child card grid ───────────────────────
  if (item.is_lot) {
    const { rows: children } = await pool.query(`SELECT * FROM inventory WHERE lot_id = $1 AND status = 'available'`, [item.id]);

    const childSum = children.reduce((acc: number, c: any) => acc + p(c.listed_price), 0);
    const lotPrice = p(item.listed_price ?? item.avg_price);
    const savings = childSum - lotPrice;
    const savingsPct = childSum > 0 ? (savings / childSum) * 100 : 0;

    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        {/* Lot Header */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 bg-cyan-950 text-brand text-xs font-black px-3 py-1.5 rounded-full border border-cyan-800 mb-4 uppercase tracking-widest">
            📦 Lot Bundle
          </span>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            {item.player_name}
          </h1>
          {item.card_set && (
            <p className="text-muted font-semibold text-lg mb-6">{item.card_set}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-5xl font-black text-white tracking-tighter">
              ${p(item.listed_price ?? item.avg_price).toFixed(2)}
            </span>
            <span className="text-muted font-bold text-sm">
              {children?.length ?? 0} cards included
            </span>
          </div>
          
          {savings > 0 && (
            <div className="mt-4 flex items-center gap-2 bg-gradient-to-r from-emerald-950/60 to-emerald-900/30 border border-emerald-500/30 rounded-xl px-5 py-3 w-fit shadow-lg shadow-emerald-900/10">
               <span className="text-emerald-400 text-lg flex-shrink-0">💰</span>
               <div>
                 <p className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-0.5">Bundle Savings</p>
                 <p className="text-white font-bold text-sm tracking-wide">
                   Save <span className="text-emerald-300 font-black">${savings.toFixed(2)}</span> ({savingsPct.toFixed(0)}%) vs individual pricing
                 </p>
               </div>
            </div>
          )}

          {/* Add whole lot to cart */}
          <div className="mt-6">
            <ItemDetailClient item={item as any} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-10" />

        {/* Child cards Carousel */}
        <h2 className="text-xl font-black text-foreground mb-6 uppercase tracking-widest">
          Cards In This Lot
        </h2>
        {children && children.length > 0 ? (
          <div className="relative">
            <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory hide-scrollbars" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {children.map((child: any) => (
                <div key={child.id} className="snap-start flex-shrink-0 w-[280px]">
                  <ProductCard item={child as any} discountRate={settings.oracle_discount_percentage} />
                </div>
              ))}
            </div>
            {/* Soft fade gradients for horizontal scrolling indicator */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-zinc-950 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-950 to-transparent" />
          </div>
        ) : (
          <div className="py-20 text-center text-muted font-medium">
             No individual cards are currently linked to this lot.
          </div>
        )}
      </div>
    )
  }

  // ── INDIVIDUAL CARD PAGE: fetch parent lot if this card is part of one ──
  let parentLot: typeof item | null = null
  if (item.lot_id) {
    const { rows: lotRows } = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [item.lot_id]);
    const lot = lotRows[0];
    parentLot = lot ?? null
  }
  const pricing = deriveDisplayPricing({
    listed_price: item.listed_price,
    avg_price: item.avg_price,
    oracle_projection: (item as any).oracle_projection,
    oracle_discount_percentage: settings.oracle_discount_percentage,
  })
  const playerIndexCalcUrl = buildPlayerIndexForecasterUrl(item as any)
  const isLiveAuction = Boolean((item as any).is_auction) && (item as any).auction_status === 'live'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      {/* Bundle-Save Banner */}
      {parentLot && (
        <Link
          href={`/item/${parentLot.id}`}
          className="group flex items-center gap-4 bg-gradient-to-r from-amber-950/60 to-amber-900/30 border border-amber-700/50 rounded-2xl px-6 py-4 mb-8 hover:border-amber-500 transition-all shadow-lg hover:shadow-amber-900/20"
        >
          <span className="text-3xl flex-shrink-0">📦</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-400 font-black text-sm uppercase tracking-widest mb-0.5">
              Bundle &amp; Save
            </p>
            <p className="text-white font-bold text-base leading-snug">
              This card is part of the{' '}
              <span className="text-amber-300">
                {parentLot.player_name}
              </span>{' '}
              lot — buy the whole bundle for{' '}
              <span className="text-amber-300 font-black">
                ${p(parentLot.listed_price ?? parentLot.avg_price).toFixed(2)}
              </span>
            </p>
          </div>
          <span className="text-amber-500 font-black text-sm flex-shrink-0 group-hover:translate-x-1 transition-transform">
            View Lot →
          </span>
        </Link>
      )}

      {/* Card detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        {/* Images */}
        <div className="space-y-4">
          {item.image_url && (
            <div className="rounded-2xl overflow-hidden border border-border bg-background shadow-2xl aspect-[2.5/3.5] flex items-center justify-center relative group">
              <ImageMagnifier src={item.image_url} alt={`${item.player_name} front`} />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none z-10" />
              {!isLiveAuction &&
                pricing.hasProjection &&
                pricing.percentBelowPlayerIndex > 0 && (
                  <PlayerIndexForecastLink
                    href={playerIndexCalcUrl}
                    className="absolute top-3 left-3 z-20 bg-indigo-900/95 text-indigo-200 text-[11px] px-3 py-1.5 rounded-full border border-indigo-600 font-black shadow-lg hover:bg-indigo-800 transition-colors pointer-events-auto"
                  >
                    🔥 {pricing.percentBelowPlayerIndex.toFixed(0)}% Below Player Index
                  </PlayerIndexForecastLink>
                )}
            </div>
          )}
          {item.back_image_url && (
            <div className="rounded-2xl overflow-hidden border border-border bg-background shadow-xl aspect-[2.5/3.5] flex items-center justify-center relative group">
              <ImageMagnifier src={item.back_image_url} alt={`${item.player_name} back`} />
            </div>
          )}
          {item.coined_image_url && (
            <div className="rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-emerald-950/20 shadow-xl aspect-[2.5/3.5] flex items-center justify-center p-2 relative">
              <div className="absolute top-4 right-4 bg-emerald-500 text-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-10 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-background animate-pulse" /> Validated
              </div>
              <img
                src={item.coined_image_url}
                alt={`${item.player_name} physical coin proof`}
                className="w-full h-full object-contain drop-shadow-xl rounded-xl"
              />
            </div>
          )}
        </div>

        {/* Details + CTA */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-tight mb-1">
              {item.player_name}
            </h1>
            {item.team_name && (
              <p className="text-muted font-semibold text-base">{item.team_name}</p>
            )}
          </div>

          <div className="space-y-1 text-sm text-muted font-semibold border-t border-border pt-4">
            {item.card_set && <p><span className="text-muted">Set:</span> {item.card_set}</p>}
            {item.card_number && <p><span className="text-muted">Card #:</span> {item.card_number}</p>}
            {(item as any).print_run && <p><span className="text-muted">Numbered To:</span> /{(item as any).print_run}</p>}
            {item.parallel_insert_type && (
              <p><span className="text-muted">Parallel / Insert:</span>{' '}
                <span className="text-brand font-bold">{item.parallel_insert_type}</span>
              </p>
            )}
          </div>

          {/* Attribute badges */}
          {((item as any).is_rookie || (item as any).is_auto || (item as any).is_relic || ((item as any).grading_company && (item as any).grade)) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(item as any).is_rookie && (
                <span className="text-xs font-black bg-yellow-400/15 text-yellow-400 border border-yellow-400/40 px-2.5 py-1 rounded-full uppercase tracking-wider">RC</span>
              )}
              {(item as any).is_auto && (
                <span className="text-xs font-black bg-blue-400/15 text-blue-400 border border-blue-400/40 px-2.5 py-1 rounded-full uppercase tracking-wider">Auto</span>
              )}
              {(item as any).is_relic && (
                <span className="text-xs font-black bg-purple-400/15 text-purple-400 border border-purple-400/40 px-2.5 py-1 rounded-full uppercase tracking-wider">Relic</span>
              )}
              {(item as any).grading_company && (item as any).grade && (
                <span className="text-xs font-black bg-emerald-400/15 text-emerald-400 border border-emerald-400/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {(item as any).grading_company} {(item as any).grade}
                </span>
              )}
            </div>
          )}

          {/* Pricing — hidden for live auction so store price never conflicts with bidding */}
          <div className="border-t border-border pt-4">
            {isLiveAuction ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                  Live on auction
                </p>
                {p((item as any).current_bid) > 0 && (
                  <p className="text-lg text-white mt-2">
                    Current high bid:{' '}
                    <span className="font-mono font-black text-cyan-400">
                      ${p((item as any).current_bid).toFixed(2)}
                    </span>
                  </p>
                )}
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  This card is on the live block — storefront buy-now pricing is hidden. Open{' '}
                  <Link href="/auction" className="text-amber-300 font-bold hover:underline">
                    Live Auctions
                  </Link>{' '}
                  to place a bid.
                </p>
              </div>
            ) : pricing.hasProjection ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <PlayerIndexForecastLink
                    href={playerIndexCalcUrl}
                    className="text-[11px] uppercase tracking-widest text-indigo-300 font-bold hover:text-indigo-200 underline-offset-2 hover:underline"
                  >
                    Player Index
                    <span className="line-through opacity-70 ml-1">${pricing.playerIndexPrice.toFixed(2)}</span>
                  </PlayerIndexForecastLink>
                  {pricing.discountPercent > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-200 border border-indigo-700/70">
                    {pricing.discountPercent.toFixed(0)}% below Player Index
                    </span>
                  )}
                  {(item as any).oracle_trend_percentage != null && (
                    <span className={`text-[11px] font-semibold ${p((item as any).oracle_trend_percentage) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Trend {p((item as any).oracle_trend_percentage) >= 0 ? '+' : '-'}{Math.abs(p((item as any).oracle_trend_percentage)).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-5xl font-black text-white tracking-tighter">
                    ${pricing.effectiveStorePrice.toFixed(2)}
                  </p>
                  {(item as any).trend_data && Array.isArray((item as any).trend_data) && (item as any).trend_data.length > 0 && (
                    <MarketSparkline
                       data={(item as any).trend_data}
                       playerIndexUrl={playerIndexCalcUrl}
                    />
                  )}
                </div>
                {pricing.savingsAmount > 0 && (
                  <p className="text-emerald-400 font-bold text-sm mt-1">
                    You save ${pricing.savingsAmount.toFixed(2)}
                  </p>
                )}
                {pricing.hasManualOverride && (
                  <p className="text-amber-300 font-semibold text-xs mt-1">
                    Manual price override active
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-5xl font-black text-white tracking-tighter">
                  ${p(item.listed_price ?? item.avg_price).toFixed(2)}
                </p>
                {(item as any).trend_data && Array.isArray((item as any).trend_data) && (item as any).trend_data.length > 0 && (
                  <MarketSparkline
                     data={(item as any).trend_data}
                     playerIndexUrl={playerIndexCalcUrl}
                  />
                )}
              </div>
            )}
          </div>

          {/* Public Analytics & Forecasting Block */}
          {item.show_forecast && (
            <div className="border-t border-border pt-4 mt-2">
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-4 py-4 shadow-lg">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-2">
                  Analytics &amp; Forecasting
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300 font-semibold">Player Index Projection ({settings.projection_timeframe || '90-Day'})</p>
                  <p className={`text-xl font-mono font-black ${Number(item.oracle_projection) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    ${Number(item.oracle_projection).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  This represents the algorithm's raw mathematical forecast of the asset's trajectory over the selected timeframe, accounting for player performance and market momentum.
                </p>
              </div>
            </div>
          )}

          {/* Add to Cart / PayPal */}
          <div className="mt-2">
            <ItemDetailClient item={item as any} />
          </div>
        </div>
      </div>
    </div>
  )
}
