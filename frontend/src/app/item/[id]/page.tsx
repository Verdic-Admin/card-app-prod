import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CardGrid } from '@/components/CardGrid'
import { ItemDetailClient } from '@/components/ItemDetailClient'

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) {
    return {
      title: 'Item Not Found | Sports Card Store',
      description: 'The requested sports card could not be found.',
    }
  }

  const displayPrice = (item.listed_price ?? item.avg_price ?? 0).toFixed(2)
  const title = `${item.player_name} - ${item.card_set || ''} | $${displayPrice}`
  
  let descriptionParts = []
  if (item.parallel_insert_type) descriptionParts.push(`Parallel/Insert: ${item.parallel_insert_type}`)
  if (item.team_name) descriptionParts.push(`Team: ${item.team_name}`)
  if (item.is_lot) descriptionParts.push(`📦 Lot Bundle`)
  
  const description = descriptionParts.length > 0 
    ? descriptionParts.join(' · ') 
    : 'View this card and more on our zero-fee storefront.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: item.image_url ? [item.image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: item.image_url ? [item.image_url] : [],
    },
  }
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // ── Fetch the primary item ──────────────────────────────────────────────
  const { data: item, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !item) return notFound()

  // ── LOT PAGE: render parent lot + child card grid ───────────────────────
  if (item.is_lot) {
    const { data: children } = await supabase
      .from('inventory')
      .select('*')
      .eq('lot_id', item.id)
      .eq('status', 'available')

    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        {/* Lot Header */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 bg-cyan-950 text-cyan-400 text-xs font-black px-3 py-1.5 rounded-full border border-cyan-800 mb-4 uppercase tracking-widest">
            📦 Lot Bundle
          </span>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            {item.player_name}
          </h1>
          {item.card_set && (
            <p className="text-zinc-400 font-semibold text-lg mb-6">{item.card_set}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-5xl font-black text-white tracking-tighter">
              ${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}
            </span>
            <span className="text-zinc-500 font-bold text-sm">
              {children?.length ?? 0} cards included
            </span>
          </div>

          {/* Add whole lot to cart */}
          <div className="mt-6">
            <ItemDetailClient item={item as any} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 mb-10" />

        {/* Child cards */}
        <h2 className="text-xl font-black text-zinc-300 mb-6 uppercase tracking-widest">
          Cards In This Lot
        </h2>
        <CardGrid
          items={(children ?? []) as any}
          emptyMessage="No individual cards are currently linked to this lot."
        />
      </div>
    )
  }

  // ── INDIVIDUAL CARD PAGE: fetch parent lot if this card is part of one ──
  let parentLot: typeof item | null = null
  if (item.lot_id) {
    const { data: lot } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', item.lot_id)
      .single()
    parentLot = lot ?? null
  }

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
                ${(parentLot.listed_price ?? parentLot.avg_price ?? 0).toFixed(2)}
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
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl aspect-[2.5/3.5] flex items-center justify-center p-6 relative group">
              <img
                src={item.image_url}
                alt={`${item.player_name} front`}
                className="w-full h-full object-contain drop-shadow-2xl"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
            </div>
          )}
          {item.back_image_url && (
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-xl aspect-[2.5/3.5] flex items-center justify-center p-6 relative">
              <img
                src={item.back_image_url}
                alt={`${item.player_name} back`}
                className="w-full h-full object-contain drop-shadow-xl opacity-90"
              />
            </div>
          )}
          {item.coined_image_url && (
            <div className="rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-emerald-950/20 shadow-xl aspect-[2.5/3.5] flex items-center justify-center p-2 relative">
              <div className="absolute top-4 right-4 bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-10 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-950 animate-pulse" /> Validated
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
              <p className="text-zinc-400 font-semibold text-base">{item.team_name}</p>
            )}
          </div>

          <div className="space-y-1 text-sm text-zinc-400 font-semibold border-t border-zinc-800 pt-4">
            {item.card_set && <p><span className="text-zinc-500">Set:</span> {item.card_set}</p>}
            {item.card_number && <p><span className="text-zinc-500">Card #:</span> {item.card_number}</p>}
            {item.parallel_insert_type && (
              <p><span className="text-zinc-500">Parallel / Insert:</span>{' '}
                <span className="text-cyan-400 font-bold">{item.parallel_insert_type}</span>
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="border-t border-zinc-800 pt-4">
            {(item as any).oracle_projection && (item as any).oracle_projection > 0 ? (
              <div>
                <p className="text-[11px] uppercase tracking-widest text-indigo-400 font-bold mb-1">
                  🔮 Player Index Value:{' '}
                  <span className="line-through opacity-60">
                    ${(item as any).oracle_projection.toFixed(2)}
                  </span>
                </p>
                <p className="text-5xl font-black text-white tracking-tighter">
                  ${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}
                </p>
                {item.listed_price && item.listed_price < (item as any).oracle_projection && (
                  <p className="text-emerald-400 font-bold text-sm mt-1">
                    You save ${((item as any).oracle_projection - item.listed_price).toFixed(2)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-5xl font-black text-white tracking-tighter">
                ${(item.listed_price ?? item.avg_price ?? 0).toFixed(2)}
              </p>
            )}
          </div>

          {/* Add to Cart / PayPal */}
          <div className="mt-2">
            <ItemDetailClient item={item as any} />
          </div>
        </div>
      </div>
    </div>
  )
}
