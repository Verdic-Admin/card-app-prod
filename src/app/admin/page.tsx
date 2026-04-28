import pool from '@/utils/db';
import { redirect } from 'next/navigation'
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard'
import { InventoryTable } from '@/components/admin/InventoryTable'
import { LedgerDashboard } from '@/components/admin/LedgerDashboard'
import { CollectorRequestsCRM } from '@/components/admin/CollectorRequestsCRM'
import { PendingApprovalsQueue } from '@/components/admin/PendingApprovalsQueue'
import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'
import { AutoUpdateReminder } from '@/components/admin/AutoUpdateReminder'

import { price } from '@/utils/math'

export const dynamic = 'force-dynamic'

function normalizeInventoryMoneyFields<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    listed_price: row.listed_price == null ? null : price(row.listed_price),
    avg_price: row.avg_price == null ? null : price(row.avg_price),
    cost_basis: row.cost_basis == null ? null : price(row.cost_basis),
    current_bid: row.current_bid == null ? null : price(row.current_bid),
    oracle_projection: row.oracle_projection == null ? null : price(row.oracle_projection),
    oracle_trend_percentage: row.oracle_trend_percentage == null ? null : price(row.oracle_trend_percentage),
  };
}

/** Pull a readable message off an unknown error. Next.js strips thrown messages in prod,
 *  so we render this text in a banner instead of letting the digest hide it. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e != null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export default async function AdminPage() {
  let inventory: any[] = [];
  let inventoryError: string | null = null;
  try {
    const { rows } = await pool.query(`SELECT * FROM inventory ORDER BY player_name ASC`);
    inventory = (rows as Record<string, unknown>[]).map(normalizeInventoryMoneyFields) as any[];
  } catch (e) {
    inventoryError = errorMessage(e);
    console.error('[admin] inventory query failed:', e);
  }

  // Fetch Oracle discount percentage and auction settings
  let settings: Record<string, unknown> | undefined;
  let settingsError: string | null = null;
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT oracle_discount_percentage, projection_timeframe FROM store_settings WHERE id = 1`,
    );
    settings = storeRows[0];
  } catch (e) {
    settingsError = errorMessage(e);
    console.error('[admin] store_settings query failed:', e);
  }

  const discountRate = (settings?.oracle_discount_percentage as number | undefined) || 0
  const projectionTimeframe = (settings?.projection_timeframe as string | undefined) || '90-Day'

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
    console.warn('[admin] auction_bids high-bidder map skipped:', e)
  }

  const soldItems = (inventory as any[] || []).filter(item => item.status === 'sold')
  const auctionPendingCount = (inventory as any[]).filter(
    (i) => i.is_auction && i.auction_status === 'pending',
  ).length

  let pendingPaymentsCount = 0;
  let pendingAuctionsCount = 0;
  let draftCardsCount = 0;
  try {
    const { rows: paymentRows } = await pool.query(`SELECT COUNT(*) FROM trade_offers WHERE status = 'pending_payment'`);
    pendingPaymentsCount = parseInt(paymentRows[0].count, 10);

    const { rows: auctionRows } = await pool.query(`SELECT COUNT(*) FROM inventory WHERE is_auction = true AND auction_status = 'pending_approval'`);
    pendingAuctionsCount = parseInt(auctionRows[0].count, 10);

    const { rows: draftRows } = await pool.query(`SELECT COUNT(*) FROM scan_staging`);
    draftCardsCount = parseInt(draftRows[0].count, 10);
  } catch (e) {
    console.error('[admin] failed to fetch command center metrics:', e);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-4">
        <AutoUpdateReminder />
      </div>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Admin Platform</h1>
          <p className="text-muted mt-1 font-medium">Manage inventory, perform massive bulk scans, and track sales.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/auction-studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-slate-950 font-black rounded-lg hover:bg-amber-400 transition-colors shadow-md border border-amber-400/50 text-sm uppercase tracking-wide"
          >
            <Gavel className="w-4 h-4" />
            Auction staging
            {auctionPendingCount > 0 && (
              <span className="ml-0.5 bg-slate-900 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                {auctionPendingCount} pending
              </span>
            )}
          </Link>
          <Link href="/admin/add-inventory" className="px-5 py-2 bg-brand text-background font-bold rounded-lg hover:bg-brand/90 transition-colors shadow-sm">
            + Add Inventory
          </Link>
          <Link href="/admin/design" className="px-4 py-2 bg-violet-50 text-violet-700 font-bold rounded-lg hover:bg-violet-100 transition-colors">
            Brand & Design
          </Link>
          <Link href="/admin/settings" className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
            Store Operations
          </Link>
          <a href="/docs/Operations-Guide.pdf" download="Operations-Guide.pdf" className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg hover:bg-slate-200 transition-colors">
            Operations Guide
          </a>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-bold text-foreground mb-4">Command Center</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Orders Pending Payment</h3>
              <p className="text-3xl font-black text-amber-500">{pendingPaymentsCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 flex items-center justify-center rounded-full">
              <span className="text-2xl" aria-hidden="true">⏳</span>
            </div>
          </div>
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Pending Auctions</h3>
              <p className="text-3xl font-black text-indigo-500">{pendingAuctionsCount}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-500/10 flex items-center justify-center rounded-full">
              <span className="text-2xl" aria-hidden="true">🔨</span>
            </div>
          </div>
          <div className="bg-surface border border-border p-5 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-1">Draft Cards Awaiting</h3>
              <p className="text-3xl font-black text-emerald-500">{draftCardsCount}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 flex items-center justify-center rounded-full">
              <span className="text-2xl" aria-hidden="true">📝</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-10">
        {(inventoryError || settingsError) && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-xl p-4 space-y-2">
            <p className="font-black uppercase tracking-wide text-xs">
              Admin data loader error — contact support if this persists
            </p>
            {inventoryError && (
              <p className="text-sm font-mono break-words">
                <span className="font-black">inventory:</span> {inventoryError}
              </p>
            )}
            {settingsError && (
              <p className="text-sm font-mono break-words">
                <span className="font-black">store_settings:</span> {settingsError}
              </p>
            )}
            <p className="text-xs font-medium text-red-700">
              The page rendered with empty data so you can still access the wizard and other tools below.
              A redeploy normally runs <code className="bg-red-100 px-1 rounded">init_db.js</code>, which adds any missing columns automatically.
            </p>
          </div>
        )}

        {inventory.length === 0 && !inventoryError && (
          <div className="bg-indigo-600 rounded-2xl shadow-xl overflow-hidden relative mb-6">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            <div className="px-6 py-6 md:px-10 md:py-8 relative z-10 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-2">
                   <span className="md:hidden">🚀</span> Welcome to your new Edge Storefront!
                </h2>
                <p className="text-indigo-100 text-sm md:text-base font-medium leading-relaxed">
                  Your storefront is successfully deployed and connected. The database is primed. Now all you need is your inventory. Site instructions are automatically turned on and are available by clicking the <strong className="text-white bg-indigo-500/50 px-2 py-0.5 rounded ml-1">? Instructions</strong> button next to any admin tool!
                </p>
              </div>
              <div className="hidden md:block w-24 h-24 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse border-4 border-indigo-400 shadow-inner">
                 <span className="text-4xl">🚀</span>
              </div>
            </div>
          </div>
        )}

        <div>
          <LedgerDashboard soldItems={soldItems} />
        </div>
        <div>
          <CollectorRequestsCRM />
        </div>
        <div>
          <PendingApprovalsQueue />
        </div>
        <div className="bg-amber-950/20 border border-amber-700/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-foreground font-medium">
            <strong className="font-black text-amber-500">Auctions</strong> — stage cards, add coin photos, and go live in
            one place. Use the <strong className="text-foreground">Auction staging</strong> button above.
          </p>
          <Link
            href="/admin/auction-studio"
            className="shrink-0 text-center sm:text-left px-4 py-2 bg-amber-500 text-slate-950 font-black rounded-lg text-sm hover:bg-amber-400"
          >
            Open auction studio →
          </Link>
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mt-10">
          <h2 className="text-xl font-bold text-foreground mb-6 flex justify-between items-center">
             <span className="flex items-center gap-2">
                Live Inventory Database
                <InstructionTrigger 
                   title="Inventory CRM Instructions"
                   steps={[
                      { title: "Pricing Engine Rules", content: "The background Player Index constantly recalculates values based on incoming metadata. Adjust your Target Percentage in settings to adapt your inventory." },
                      { title: "Mass Categorization", content: "If you need to rapidly label players for upcoming searches, bulk select them using the left-hand checkboxes and assign standardized taxonomies." }
                   ]}
                />
             </span>
             <Link href="/admin/add-inventory" className="px-4 py-2 bg-surface-hover text-foreground font-bold rounded-lg hover:bg-border transition-colors text-sm border border-border mt-0">
               + Add Inventory
             </Link>
          </h2>
          <InventoryTable
            initialItems={(inventory as any[]) || []}
            discountRate={discountRate}
            projectionTimeframe={projectionTimeframe}
            auctionLeadByItemId={auctionLeadByItemId}
          />
        </div>
      </div>
    </div>
  )
}
