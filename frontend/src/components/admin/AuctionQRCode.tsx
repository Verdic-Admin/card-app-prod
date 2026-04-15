'use client'

import QRCode from 'react-qr-code'

export function AuctionQRCode({ isVisible, toggleVisibility }: { isVisible: boolean, toggleVisibility: () => void }) {
  if (!isVisible) return null;
  
  const url = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/auction` : 'http://localhost:3000/auction';

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
         <QRCode value={url} size={220} className="w-full h-auto text-black" fgColor="#000000" bgColor="#FFFFFF" />
      </div>
      <div className="mt-4 text-sm font-bold text-slate-400 tracking-wider blur-[1px] hover:blur-none transition-all">
        {url}
      </div>
    </div>
  )
}
