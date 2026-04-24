import Link from 'next/link';

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-900/50">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Finish linking your store</h1>
        <p className="text-muted mb-6 text-sm leading-relaxed">
          Set <span className="font-mono text-foreground">PLAYERINDEX_API_KEY</span> in your Vercel project&apos;s Environment Variables to the key you
          copied from Player Index (<span className="font-mono">/claim</span> or{' '}
          <span className="font-mono">/developers</span>), then redeploy.
        </p>
        <p className="text-muted mb-8 text-xs leading-relaxed">
          Optional: <span className="font-mono text-foreground">FINTECH_API_URL</span> /{' '}
          <span className="font-mono text-foreground">API_BASE_URL</span> default to the public gateway if unset.
        </p>
        <Link
          href="https://playerindexdata.com/claim"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-brand text-background hover:opacity-90 transition-opacity py-3 rounded-lg font-bold tracking-wide uppercase text-sm"
        >
          Open Player Index setup
        </Link>
      </div>
    </div>
  );
}
