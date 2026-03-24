'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { calculateBasePBI, executeShadowBookUpsert, PbiEntity } from '@/app/actions/pricing';
import { ExportCsvButton } from '@/components/admin/ExportCsvButton';

export default function PricingEngineDashboard() {
  const [engineResults, setEngineResults] = useState<PbiEntity[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpserting, setIsUpserting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  const handleRunEngine = async () => {
    setIsProcessing(true);
    setErrorStatus(null);
    setSuccessStatus(null);
    try {
      const results = await calculateBasePBI();
      setEngineResults(results);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || 'Failed to execute the pricing engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpsert = async () => {
    setIsUpserting(true);
    setErrorStatus(null);
    setSuccessStatus(null);
    try {
      const result = await executeShadowBookUpsert();
      if (result.success) {
        setSuccessStatus(result.message);
      }
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || 'Failed to execute batched upsert.');
    } finally {
      setIsUpserting(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Pricing Engine
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Dry Run Configuration: Simulating the Player Base Index (PBI).
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
            Back to Admin
          </Link>
          <button 
            onClick={handleUpsert}
            disabled={isUpserting || isProcessing}
            className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isUpserting ? 'Committing...' : 'Commit to Shadow Book (Upsert)'}
          </button>
          <button 
            onClick={handleRunEngine}
            disabled={isProcessing || isUpserting}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isProcessing ? 'Simulating Engine...' : 'Run Engine (Dry Run)'}
          </button>
        </div>
      </div>

      {successStatus && (
        <div className="bg-green-50 border border-green-200 text-green-700 font-semibold px-4 py-3 rounded mb-6 flex justify-between items-center">
          <span>{successStatus}</span>
          <Link href="/admin/alpha" className="underline hover:text-green-800">Review Alpha Dashboard &rarr;</Link>
        </div>
      )}

      {errorStatus && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errorStatus}
        </div>
      )}

      {engineResults !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Engine Simulation Output</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-500">
                Total Entities Matched: <span className="font-bold text-slate-800">{engineResults.length}</span>
              </span>
              <ExportCsvButton data={engineResults} filename="Pricing_Engine_Dry_Run.csv" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Normalized Entity (Ticker)
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned Assets
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Live Stat
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider title='Fundamental Alpha'">
                    &alpha;f Momentum
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Calculated Baseline PBI
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider title='Sentiment Alpha'">
                    &alpha;s Hype
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-extrabold text-indigo-700 uppercase tracking-wider bg-indigo-50/50">
                    Target PBI Forecast
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {engineResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No liquid assets found to calculate.
                    </td>
                  </tr>
                ) : (
                  engineResults.map((player) => {
                    // Process alpha_f conditions
                    let alphaColor = "text-slate-500";
                    let alphaBg = "";

                    if (player.alphaF !== undefined) {
                      if (player.alphaF > 0) {
                        alphaColor = "text-green-700 font-bold";
                        alphaBg = "bg-green-50 px-2 py-1 rounded-md";
                      } else if (player.alphaF < 0) {
                        alphaColor = "text-red-700 font-bold";
                        alphaBg = "bg-red-50 px-2 py-1 rounded-md";
                      } else {
                        alphaColor = "text-slate-400 font-medium";
                      }
                    }

                    // Process alpha_s conditions
                    let sentColor = "text-slate-400";
                    let sentBg = "";

                    if (player.alphaS !== undefined) {
                      if (player.alphaS > 0.15) {
                        sentColor = "text-green-700 font-bold";
                        sentBg = "bg-green-50 px-2 py-1 rounded-md";
                      } else if (player.alphaS < -0.15) {
                        sentColor = "text-red-700 font-bold";
                        sentBg = "bg-red-50 px-2 py-1 rounded-md";
                      } else {
                        sentColor = "text-slate-400 font-medium";
                      }
                    }

                    return (
                      <tr key={player.playerEntity} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                             {player.playerEntity}
                           </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-600 font-medium">
                          {player.assetCount} {player.assetCount === 1 ? 'card' : 'cards'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900 font-medium">
                          {player.liveStatValue !== undefined ? `${player.liveStatType} ${player.liveStatValue.toFixed(3)}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {player.alphaF !== undefined ? (
                            <span className={`${alphaColor} ${alphaBg} inline-block`}>
                              {player.alphaF > 0 ? '+' : ''}{(player.alphaF * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700 font-medium bg-slate-50 border-r border-l border-slate-100">
                          ${player.medianPbi.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {player.alphaS !== undefined ? (
                            <span className={`${sentColor} ${sentBg} inline-block`}>
                              {player.alphaS > 0 ? '+' : ''}{player.alphaS.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-indigo-800 font-extrabold bg-indigo-50 border-l border-indigo-100/50">
                          {player.targetPbi !== undefined ? `$${player.targetPbi.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {engineResults === null && !isProcessing && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-12 text-center">
          <p className="text-slate-500 mb-4">The quantitative pricing engine is currently idle.</p>
          <button 
            onClick={handleRunEngine}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            Trigger Infrastructure Scan
          </button>
        </div>
      )}
    </div>
  );
}
