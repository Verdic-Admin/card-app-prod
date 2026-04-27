'use client'

import QRCode from 'react-qr-code'

interface AuctionQRCodeProps {
  isVisible: boolean
  toggleVisibility: () => void
  /** The URL the QR code should encode — must be a full URL entered by the store owner. */
  url?: string | null
}

export function AuctionQRCode({ isVisible, url }: AuctionQRCodeProps) {
  if (!isVisible) return null;

  // Only render if we have a real URL
  if (!url || url.trim() === '') {
    return (
      <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2">
        <p className="text-sm font-bold text-slate-500">No URL set</p>
        <p className="text-xs text-slate-400">Enter your bidding page URL above to generate the QR code.</p>
      </div>
    );
  }

  return (
    <div className="bg-black p-5 rounded-xl text-white font-mono flex flex-col items-center justify-center border-4 border-slate-900 shadow-2xl">
      <div className="text-lg font-black uppercase tracking-widest mb-3 text-center">
        Scan To Bid <span className="text-red-500 animate-pulse">Live</span>
      </div>
      <div className="bg-white p-3 rounded-xl border-8 border-slate-800">
        <QRCode value={url.trim()} size={200} className="w-full h-auto text-black" fgColor="#000000" bgColor="#FFFFFF" />
      </div>
    </div>
  )
}
