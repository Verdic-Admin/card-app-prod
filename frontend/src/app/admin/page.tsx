import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard'
import { InventoryTable } from '@/components/admin/InventoryTable'
import { SignOutButton } from '@/components/admin/SignOutButton'
import { LedgerDashboard } from '@/components/admin/LedgerDashboard'
import { TradeLeadsCRM } from '@/components/admin/TradeLeadsCRM'
import { AuctionManager } from '@/components/admin/AuctionManager'

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*')
    .order('player_name', { ascending: true })

  // Fetch Oracle discount percentage and stream settings
  const { data: settings } = await (supabase as any)
    .from('store_settings')
    .select('oracle_discount_percentage, live_stream_url')
    .eq('id', 1)
    .single()
  const discountRate = settings?.oracle_discount_percentage || 0
  const liveStreamUrl = settings?.live_stream_url || null

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
          <SignOutButton />
        </div>
      </div>

      <div className="flex flex-col space-y-10">
        <div>
          <LedgerDashboard soldItems={soldItems} />
        </div>
        <div>
          <BulkIngestionWizard />
        </div>
        <div>
          <TradeLeadsCRM />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex justify-between items-center">
             <span>Auction Manager 🔴</span>
          </h2>
          <AuctionManager initialItems={inventory || []} initialStreamUrl={liveStreamUrl} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex justify-between items-center">
             <span>Live Inventory Database</span>
          </h2>
          <InventoryTable initialItems={inventory || []} discountRate={discountRate} />
        </div>
      </div>
    </div>
  )
}
