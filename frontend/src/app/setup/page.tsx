export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-900/50">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Infrastructure Setup Required</h1>
        <p className="text-zinc-400 mb-8">
          Your storefront is missing the <code className="bg-zinc-800 px-2 py-0.5 rounded text-cyan-400">PLAYERINDEX_API_KEY</code>. You must configure this environment variable to access the Admin dashboard and unlock backend orchestration.
        </p>
        <a 
          href="https://playerindexdata.com/developer"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-white text-zinc-950 hover:bg-zinc-200 transition-colors py-3 rounded-lg font-bold tracking-wide uppercase text-sm"
        >
          Get Your API Key
        </a>
      </div>
    </div>
  );
}
