'use client'

import QRCode from 'react-qr-code'

interface AuctionQRCodeProps {
  isVisible: boolean
  toggleVisibility: () => void
  /** Override URL encoded into the QR. Falls back to the store's `/bid` short route. */
  url?: string | null
}

export function AuctionQRCode({ isVisible, toggleVisibility, url }: AuctionQRCodeProps) {
  if (!isVisible) return null;

  const siteRoot = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const resolvedUrl =
    (typeof url === 'string' && url.trim().length > 0 ? url.trim() : null) ??
    `${siteRoot}/bid`;

  return (
    <div className="bg-black p-6 rounded-xl text-white font-mono flex flex-col items-center justify-center border-4 border-slate-900 shadow-2xl relative">
      <button 
        onClick={toggleVisibility} 
        className="absolute top-2 right-3 text-slate-500 hover:text-white font-bold"
      >
        ✕
      </button>
      <div className="text-2xl font-black uppercase tracking-widest mb-4 text-center mt-2">
        Scan To Bid <span className="text-red-500 animate-pulse">Live</span>
      </div>
      <div className="bg-white p-4 rounded-xl border-8 border-slate-800">
         <QRCode value={resolvedUrl} size={220} className="w-full h-auto text-black" fgColor="#000000" bgColor="#FFFFFF" />
      </div>
      <div className="mt-4 text-sm font-bold text-slate-400 tracking-wider blur-[1px] hover:blur-none transition-all">
        {resolvedUrl}
      </div>
    </div>
  )
}
