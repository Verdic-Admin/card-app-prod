'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Clock } from 'lucide-react'

interface CronInfo {
  url: string
  secret: string | null
}

async function fetchCronInfo(): Promise<CronInfo> {
  const res = await fetch('/api/admin/cron-info')
  if (!res.ok) throw new Error('Failed to load')
  return res.json()
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

export function CronSetupPanel() {
  const [info, setInfo] = useState<CronInfo | null>(null)

  useEffect(() => {
    fetchCronInfo().then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  const authHeader = info.secret ? `Bearer ${info.secret}` : '⚠ CRON_SECRET not set'
  const hasSecret = !!info.secret

  return (
    <div className="mt-8 border-t border-border pt-8">
      <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
        <span className="bg-amber-100 text-amber-700 w-6 h-6 flex items-center justify-center rounded-full text-xs">
          <Clock className="w-3.5 h-3.5" />
        </span>
        Nightly Automation
      </h3>
      <p className="text-sm text-muted font-medium mb-4">
        Wire this endpoint into a cron service (Railway Cron, Upstash, cron-job.org) to automatically
        finalize expired auctions every night. Set the schedule to{' '}
        <code className="bg-slate-100 px-1 rounded text-slate-700 text-xs">0 3 * * *</code>{' '}
        (3 AM daily).
      </p>

      <div className="space-y-3 p-4 bg-surface md:bg-surface-hover border border-border rounded-xl">
        {/* Endpoint URL */}
        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
            Cron Endpoint URL
          </label>
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
            <code className="text-xs text-slate-700 font-mono flex-1 break-all">{info.url}</code>
            <CopyButton value={info.url} />
          </div>
        </div>

        {/* Authorization Header */}
        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
            Authorization Header
          </label>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${hasSecret ? 'bg-slate-100' : 'bg-red-50 border border-red-200'}`}>
            <code className={`text-xs font-mono flex-1 break-all ${hasSecret ? 'text-slate-700' : 'text-red-600'}`}>
              {authHeader}
            </code>
            {hasSecret && <CopyButton value={authHeader} />}
          </div>
          {!hasSecret && (
            <p className="text-xs text-red-600 font-semibold mt-1">
              Set <code className="bg-red-100 px-1 rounded">CRON_SECRET</code> in your Railway service Variables and redeploy.
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted pt-1 border-t border-border space-y-1">
          <p className="font-semibold text-foreground">Setup steps:</p>
          <ol className="list-decimal list-inside space-y-0.5 pl-1">
            <li>Go to your cron service and create a new job</li>
            <li>Set the URL to the endpoint above</li>
            <li>Set method to <strong>GET</strong></li>
            <li>Add header: <strong>Authorization</strong> → value from above</li>
            <li>Set schedule: <code className="bg-slate-100 px-1 rounded">0 3 * * *</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
