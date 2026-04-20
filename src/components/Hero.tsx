import type { StoreSettings } from "@/lib/store-settings";
import { Instagram, Twitter, Facebook } from 'lucide-react';

export function Hero({ settings }: { settings: StoreSettings }) {
  return (
    <div className="bg-zinc-950 text-white py-20 sm:py-28 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 text-white leading-tight">
          {settings?.site_name || 'Zero-Fee Sports Card Storefront'}
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto whitespace-pre-wrap leading-relaxed font-medium">
          {settings?.store_description || 'Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.'}
        </p>
        
        {(settings?.social_instagram || settings?.social_twitter || settings?.social_facebook || settings?.social_discord || settings?.social_threads) && (
            <div className="flex items-center justify-center gap-6 mt-8 pt-8 border-t border-zinc-800/60 w-full max-w-md flex-wrap">
                {settings?.social_instagram && (
                    <a href={settings.social_instagram} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 p-3 rounded-full text-zinc-400 hover:text-white hover:bg-pink-600 transition-all shadow-sm">
                        <Instagram className="w-5 h-5" />
                    </a>
                )}
                {settings?.social_twitter && (
                    <a href={settings.social_twitter} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 p-3 rounded-full text-zinc-400 hover:text-white hover:bg-sky-500 transition-all shadow-sm">
                        <Twitter className="w-5 h-5" />
                    </a>
                )}
                {settings?.social_facebook && (
                    <a href={settings.social_facebook} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 p-3 rounded-full text-zinc-400 hover:text-white hover:bg-blue-600 transition-all shadow-sm">
                        <Facebook className="w-5 h-5" />
                    </a>
                )}
                {settings?.social_discord && (
                    <a href={settings.social_discord} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 p-3 rounded-full text-zinc-400 hover:text-white hover:bg-[#5865F2] transition-all shadow-sm">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                        </svg>
                    </a>
                )}
                {settings?.social_threads && (
                    <a href={settings.social_threads} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 p-3 rounded-full text-zinc-400 hover:text-black hover:bg-white transition-all shadow-sm">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.611 12.012c0 1.58-1 2.373-2.138 2.373-1.064 0-1.745-.632-1.745-2.023v-1.092c0-1.341.776-2.184 1.942-2.184.977 0 1.734.575 1.941 1.62h.115V9.45c-.448-.655-1.184-1-2.114-1-1.637 0-2.901 1.057-2.901 3.125v1.206c0 1.839 1.137 2.919 2.815 2.919 1.482 0 2.505-.758 2.838-2.183h1.006c-.345 1.908-1.781 3.033-3.832 3.033-2.31 0-3.872-1.447-3.872-3.837v-1.103c0-2.585 1.637-4.102 3.998-4.102 2.173 0 3.655 1.345 3.655 3.253v.459h-2.171v.794h2.46zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c3.21 0 6.13-1.26 8.284-3.298l-.75-.682A10.957 10.957 0 0 1 12 22.998 10.999 10.999 0 0 1 1 12a10.997 10.997 0 0 1 11-10.998 10.996 10.996 0 0 1 10.998 11V12.7c0 1.545-.71 2.593-1.921 2.593-.655 0-1.222-.265-1.503-.94A4.321 4.321 0 0 1 16.5 15.6c-2.33 0-3.95-1.56-3.95-4.04v-1.11c0-2.56 1.71-4.08 4.03-4.08 2.21 0 3.69 1.35 3.69 3.2v.45h-1v-.47c0-1.34-.84-2.22-2.34-2.22-1.73 0-2.92 1.08-2.92 3.15v1.2c0 1.83 1.13 2.9 2.82 2.9 1.19 0 2-.69 2.27-1.63.14.73.66 1.58 1.62 1.58 1.62 0 2.45-1.26 2.45-3.32V12c0-6.07-4.93-11-11-11Z" />
                        </svg>
                    </a>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
