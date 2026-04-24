'use client'

import { useEffect } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!duration) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-200">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${
        type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
        'bg-blue-50 border-blue-200 text-blue-800'
      }`}>
        {type === 'success' && <Check className="w-5 h-5 text-emerald-600" />}
        {type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
        {type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600" />}
        <span className="text-sm font-bold">{message}</span>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg transition-colors ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
