'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { removeFromStreamQueue } from '@/app/actions/inventory'

interface LiveStreamPresentationProps {
  initialItems: any[]
  allChildren: any[]
}

export function LiveStreamPresentation({ initialItems, allChildren }: LiveStreamPresentationProps) {
  const router = useRouter()
  const [items, setItems] = useState<any[]>(initialItems)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const selectedItem = items.find(i => i.id === selectedItemId)
  
  // If the selected item is a lot, get its children
  const selectedLotChildren = selectedItem?.is_lot 
    ? allChildren.filter(c => c.lot_id === selectedItem.id)
    : []

  const handleRemoveFromQueue = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRemoving(true)
    try {
      await removeFromStreamQueue([id])
      setItems(prev => prev.filter(i => i.id !== id))
      if (selectedItemId === id) {
        setSelectedItemId(null)
      }
      router.refresh()
    } catch (e) {
      console.error("Failed to remove item:", e)
    } finally {
      setIsRemoving(false)
    }
  }

  const handleClearQueue = async () => {
    setIsRemoving(true)
    try {
      await removeFromStreamQueue(items.map(i => i.id))
      setItems([])
      setSelectedItemId(null)
      router.refresh()
    } catch (e) {
      console.error("Failed to clear queue:", e)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans">
      
      {/* Left Pane: The Queue */}
      <div className="w-80 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full relative z-10 shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900/90 backdrop-blur z-20">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Queue
            </h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">{items.length} cards staged</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearQueue}
              disabled={isRemoving}
              className="text-[10px] font-bold text-zinc-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="text-zinc-700 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-500">Queue is empty</p>
              <p className="text-xs text-zinc-600 mt-1">Stage items from the Admin Inventory panel.</p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedItemId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`
                    group cursor-pointer relative rounded-xl p-3 flex gap-3 transition-all duration-300
                    ${isSelected 
                      ? 'bg-zinc-800 ring-1 ring-zinc-700 shadow-lg scale-[1.02]' 
                      : 'bg-zinc-900/50 hover:bg-zinc-800/50 border border-transparent hover:border-zinc-800'
                    }
                  `}
                >
                  <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-950 shadow-inner">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {item.is_lot && (
                      <div className="absolute top-1 left-1 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest text-white border border-white/10 uppercase shadow-sm">
                        Lot
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={`text-sm font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                      {item.player_name}
                    </h3>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                      {item.card_set}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveFromQueue(item.id, e)}
                    className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-zinc-500 hover:text-white hover:bg-rose-500 transition-all opacity-0 group-hover:opacity-100 ${isRemoving ? 'pointer-events-none' : ''}`}
                    title="Remove from queue"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Pane: The Spotlight */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
        {/* Subtle grid background for premium feel */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center opacity-40 select-none animate-pulse-slow">
              <div className="w-48 h-64 border-2 border-dashed border-zinc-700 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-zinc-600 tracking-tight">SELECT A CARD</h2>
              <p className="text-zinc-600 font-medium mt-2">to spotlight on stream</p>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto flex flex-col items-center animate-slide-up">
              
              {/* Header Info (Optional: hide if we want strictly images, but a clean subtle header is nice) */}
              <div className="text-center mb-8 sm:mb-12">
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
                  {selectedItem.player_name}
                </h1>
                <p className="text-zinc-400 font-medium text-lg mt-2 tracking-wide uppercase">
                  {selectedItem.card_set} {selectedItem.card_number ? `· #${selectedItem.card_number}` : ''}
                </p>
                {selectedItem.is_lot && (
                  <span className="inline-block mt-4 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs font-black uppercase tracking-widest">
                    Lot of {selectedLotChildren.length + 1}
                  </span>
                )}
              </div>

              {/* Image Layout */}
              <div className="w-full overflow-y-auto custom-scrollbar max-h-[70vh] pb-8 px-4 flex flex-col items-center">
                {!selectedItem.is_lot ? (
                  /* Single Card View */
                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-16">
                    {selectedItem.image_url && (
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-rose-500 to-indigo-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <img 
                          src={selectedItem.image_url} 
                          alt="Front" 
                          className="relative max-w-[min(90vw,450px)] max-h-[min(65vh,600px)] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 transform transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                    )}
                    {selectedItem.back_image_url && (
                      <div className="relative group">
                         <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-rose-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <img 
                          src={selectedItem.back_image_url} 
                          alt="Back" 
                          className="relative max-w-[min(90vw,450px)] max-h-[min(65vh,600px)] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 transform transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Lot View (Grid of all cards) */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 auto-rows-fr w-full max-w-6xl">
                    {/* The Parent Card (if it represents a single card in the lot or a composite) */}
                    {(selectedItem.image_url || selectedItem.back_image_url) && (
                      <div className="flex flex-col items-center gap-4">
                        {selectedItem.image_url && (
                          <img src={selectedItem.image_url} alt="Lot Parent" className="max-w-[300px] w-full object-contain rounded-xl shadow-2xl border border-white/10" />
                        )}
                      </div>
                    )}
                    
                    {/* The Child Cards */}
                    {selectedLotChildren.map((child: any, idx: number) => (
                      <div key={child.id || idx} className="flex flex-col items-center gap-6">
                        {child.image_url && (
                          <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-zinc-500 to-zinc-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <img src={child.image_url} alt="Child Front" className="relative max-w-[300px] w-full object-contain rounded-xl shadow-2xl border border-white/10" />
                          </div>
                        )}
                        {child.back_image_url && (
                           <div className="relative group mt-2">
                             <img src={child.back_image_url} alt="Child Back" className="relative max-w-[300px] w-full object-contain rounded-xl shadow-2xl border border-white/10 opacity-80 hover:opacity-100 transition-opacity" />
                           </div>
                        )}
                        <div className="text-center w-full max-w-[300px]">
                          <p className="text-sm font-bold text-white truncate">{child.player_name || 'Card'}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider truncate mt-0.5">{child.card_set}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  )
}
