import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getShadowBookData } from '@/app/actions/alpha'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'

export const dynamic = 'force-dynamic'

export default async function AlphaDashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const shadowBookData = await getShadowBookData() || [];

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Alpha Dashboard (Shadow Book)
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Algorithmic Fair Value (AFV) vs. Live Inventory Listed Prices.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ExportCsvButton data={shadowBookData} filename="Alpha_Tracker_Projections.csv" />
          <Link href="/admin" className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
            Back to Admin
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Asset
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Listed Price
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AFV Target
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider title='Spoke Multiplier'">
                  $M_{'{parallel}'}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider title='Sabermetric Alpha'">
                  &alpha;f
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider title='NLP Hype Alpha'">
                  &alpha;s
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Arbitrage &Delta;
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {shadowBookData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No active inventory found.
                  </td>
                </tr>
              ) : (
                shadowBookData.map((item) => {
                  const assetName = `${item.player_name || 'Unknown'} - ${item.card_set || ''} ${item.parallel_insert_type || ''}`.trim()
                  
                  // Fix Numeric typing strictness for SSR (Supabase may parse Postgres numerics as strings)
                  const afv = item.afv != null ? Number(item.afv) : null;
                  const listedPrice = item.listed_price != null ? Number(item.listed_price) : null;
                  const alphaF = item.alpha_f != null ? Number(item.alpha_f) : null;
                  const alphaS = item.alpha_s != null ? Number(item.alpha_s) : null;
                  const mParallel = item.m_parallel != null ? Number(item.m_parallel) : null;

                  // Calculate Arbitrage Delta Percentage
                  let deltaPercent = 0;
                  if (afv != null && listedPrice != null && listedPrice > 0) {
                    deltaPercent = ((afv - listedPrice) / listedPrice) * 100;
                  }

                  // Determine conditional styling for Arbitrage Delta
                  let deltaColor = "text-slate-900";
                  let deltaBg = ""; // Optional background pill coloring
                  
                  if (deltaPercent > 15) {
                    deltaColor = "text-green-700 font-bold";
                    deltaBg = "bg-green-50 px-2 py-1 rounded-md"; // Strong Buy
                  } else if (deltaPercent < -15) {
                    deltaColor = "text-red-700 font-bold";
                    deltaBg = "bg-red-50 px-2 py-1 rounded-md"; // Strong Sell
                  } else if (afv != null && listedPrice != null) {
                     // For items mapped but within bounds
                     deltaColor = "text-slate-600";
                  }

                  const hasProjections = afv !== null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{assetName}</span>
                          {item.is_hub && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              Hub
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900 font-medium">
                        {listedPrice != null ? `$${listedPrice.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900 font-semibold bg-slate-50/50">
                        {afv != null ? `$${afv.toFixed(2)}` : <span className="text-slate-300">Unmapped</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                        {mParallel != null ? `${mParallel}x` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                        {alphaF != null ? `${(alphaF * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                        {alphaS != null ? `${(alphaS * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {hasProjections ? (
                          <span className={`${deltaColor} ${deltaBg} inline-block`}>
                            {deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
