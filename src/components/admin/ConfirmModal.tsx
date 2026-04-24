'use client'

import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmModal({ 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  onConfirm, 
  onCancel,
  danger = false
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border border-slate-200 overflow-hidden">
        <div className={`px-6 py-4 border-b ${danger ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'} flex items-center justify-between`}>
          <h3 className={`text-sm font-black flex items-center gap-2 ${danger ? 'text-red-900' : 'text-slate-900'}`}>
            {danger && <AlertTriangle className="w-4 h-4 text-red-600" />}
            {title}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">{message}</p>
        </div>
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-sm ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
