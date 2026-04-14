import { sql } from '@vercel/postgres';
import { redirect } from 'next/navigation'
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard'
import { InventoryTable } from '@/components/admin/InventoryTable'
import { LedgerDashboard } from '@/components/admin/LedgerDashboard'
import { TradeLeadsCRM } from '@/components/admin/TradeLeadsCRM'
import { CoinRequestsCRM } from '@/components/admin/CoinRequestsCRM'
import { AuctionManager } from '@/components/admin/AuctionManager'

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { rows: inventory } = await sql`SELECT * FROM inventory ORDER BY player_name ASC`;

  // Fetch Oracle discount percentage and stream settings
  const { rows: storeRows } = await sql`SELECT oracle_discount_percentage, live_stream_url, projection_timeframe FROM store_settings WHERE id = 1`;
  const settings = storeRows[0];
  const discountRate = settings?.oracle_discount_percentage || 0
  const liveStreamUrl = settings?.live_stream_url || null
  const projectionTimeframe = settings?.projection_timeframe || '90-Day'

  const soldItems = (inventory as any[] || []).filter(item => item.status === 'sold')

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Admin Platform</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage inventory, perform massive bulk scans, and track sales.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/settings" className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
            Site Settings
          </Link>
        </div>
      </div>

      <div className="flex flex-col space-y-10">
        {inventory.length === 0 && (
          <div className="bg-indigo-600 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            <div className="px-8 py-12 md:p-16 relative z-10 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Welcome to your new Edge Storefront!</h2>
                <p className="text-indigo-100 text-lg md:text-xl font-medium mb-8 leading-relaxed">
                  Your Vercel infrastructure is successfully deployed and connected. The database is primed. Now all you need is your inventory. Drop your first batch of card photos into the AI scanner below to instantly organize, price, and publish your storefront.
                </p>
                <a href="#scanner" className="inline-flex items-center justify-center bg-white text-indigo-700 font-black tracking-widest uppercase px-8 py-4 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all outline-none focus:ring-4 focus:ring-indigo-300">
                  <span className="mr-3 text-xl">📸</span> Start Scanning Now
                </a>
              </div>
              <div className="hidden md:block w-48 h-48 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse border-8 border-indigo-400">
                 <span className="text-6xl">🚀</span>
              </div>
            </div>
          </div>
        )}

        <div>
          <LedgerDashboard soldItems={soldItems} />
        </div>
        <div>
          <CoinRequestsCRM />
        </div>
        <div id="scanner" className="scroll-mt-10">
          <BulkIngestionWizard />
        </div>
        <div>
          <TradeLeadsCRM />
        </div>
        <div>
          <AuctionManager 
            initialItems={inventory || []} 
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex justify-between items-center">
             <span>Live Inventory Database</span>
          </h2>
          <InventoryTable initialItems={(inventory as any[]) || []} discountRate={discountRate} liveStreamUrl={liveStreamUrl} projectionTimeframe={projectionTimeframe} />
        </div>
      </div>
    </div>
  )
}
