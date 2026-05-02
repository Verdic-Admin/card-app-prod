'use client'

import { useState, useEffect, useRef } from 'react'
import { X, HelpCircle, GripHorizontal } from 'lucide-react'

export interface InstructionStep {
  title: string
  content: string
}

export function InstructionTrigger({ title, steps, label = "Instructions", iconOnly = false }: { title: string, steps: InstructionStep[], label?: string, iconOnly?: boolean }) {
   const [isOpen, setIsOpen] = useState(false)
   
   return (
      <>
         <button 
           onClick={() => setIsOpen(true)}
           className={iconOnly 
             ? "inline-flex items-center justify-center p-1.5 text-indigo-400 bg-indigo-950/50 hover:bg-indigo-900 border border-indigo-500/30 rounded-full shadow-sm transition-colors ml-2" 
             : "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm hover:bg-indigo-100 transition-colors ml-3"
           }
           title="View Info"
         >
           <HelpCircle className="w-4 h-4" /> {!iconOnly && label}
         </button>
         
         {isOpen && (
            <DraggableOverlay 
              title={title} 
              steps={steps} 
              onClose={() => setIsOpen(false)} 
            />
         )}
      </>
   )
}

function DraggableOverlay({ title, steps, onClose }: { title: string, steps: InstructionStep[], onClose: () => void }) {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null)

  useEffect(() => {
     // Center position initially depending on window
     setPosition({ x: window.innerWidth > 800 ? window.innerWidth - 460 : 20, y: 100 })
     setMounted(true)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return
      
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      
      setPosition({
        x: dragRef.current.initialX + dx,
        y: Math.max(0, dragRef.current.initialY + dy) 
      })
    }
    
    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (!mounted) return null

  return (
     <div 
       className={`fixed z-[100] w-80 sm:w-[420px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-opacity ${isDragging ? 'opacity-95' : 'opacity-100'}`}
       style={{
          top: `${position.y}px`,
          left: `${position.x}px`
       }}
     >
        {/* DRAG HANDLE */}
        <div 
          className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
           <div className="flex items-center gap-2 text-white/90">
             <GripHorizontal className="w-4 h-4 text-slate-400" />
             <span className="font-bold text-sm tracking-wide text-white">{title}</span>
           </div>
           
           <button 
             onClick={(e) => { e.stopPropagation(); onClose(); }}
             className="text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded transition-colors focus:outline-none"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
        
        {/* CONTENT */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
           {steps.map((s, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-2 border-b border-indigo-100 pb-2">
                   {s.title}
                 </h4>
                 <div 
                   className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap"
                 >
                   {s.content}
                 </div>
              </div>
           ))}
        </div>
     </div>
  )
}
