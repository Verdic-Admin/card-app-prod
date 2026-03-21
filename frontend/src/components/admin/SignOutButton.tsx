'use client'

import { createSupabaseClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createSupabaseClient()
  
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }
  
  return (
    <button 
      onClick={handleSignOut}
      className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  )
}
