import { StoreSettings } from "@/app/actions/settings";
import { Instagram, Twitter, Facebook } from 'lucide-react';

export function Hero({ settings }: { settings: StoreSettings }) {
  return (
    <div className="bg-zinc-950 text-white py-20 sm:py-28 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 text-white leading-tight">
          Zero-Fee Sports Card Storefront
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto whitespace-pre-wrap leading-relaxed font-medium">
          {settings?.store_description || 'Prices reflect direct-to-buyer savings. No hidden buyer premiums, just high-quality cards shipped directly to you.'}
        </p>
        
        {(settings?.social_instagram || settings?.social_twitter || settings?.social_facebook) && (
            <div className="flex items-center justify-center gap-6 mt-8 pt-8 border-t border-zinc-800/60 w-full max-w-md">
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
            </div>
        )}
      </div>
    </div>
  );
}
