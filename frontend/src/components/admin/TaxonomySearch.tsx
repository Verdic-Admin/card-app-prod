'use client'

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/utils/api';

interface TaxonomyResult {
  player_name: string;
  card_set: string;
  card_number: string;
  [key: string]: any;
}

export function TaxonomySearch({ 
  onSelect 
}: { 
  onSelect: (data: { player_name: string, card_set: string, card_number: string }) => void 
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaxonomyResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_FINTECH_API_URL || 'http://localhost:8000/fintech';
        const res = await fetchWithAuth(`${baseUrl}/v1/taxonomy/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || data || []);
        } else {
          setResults([]);
        }
      } catch (e) {
        console.error("Taxonomy search failed", e);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="relative w-full">
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
        className="block w-full border border-orange-300 rounded p-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none" 
        placeholder="Search Canonical Master List to Auto-Fill..." 
      />
      {isLoading && (
        <div className="absolute right-3 top-2 border-2 border-orange-200 border-t-orange-500 rounded-full w-5 h-5 animate-spin"></div>
      )}
      {results.length > 0 && (
         <div className="absolute top-[105%] left-0 right-0 max-h-60 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-lg z-50">
           {results.map((r, i) => (
             <div 
               key={i} 
               onClick={() => {
                 onSelect({ player_name: r.player_name, card_set: r.card_set, card_number: r.card_number });
                 setQuery('');
                 setResults([]);
               }}
               className="p-3 hover:bg-orange-50 cursor-pointer border-b last:border-b-0 text-sm transition-colors"
             >
               <div className="font-bold text-slate-900">{r.player_name}</div>
               <div className="text-xs text-slate-500 font-medium mt-0.5">{r.card_set} <span className="text-orange-500">#{r.card_number}</span></div>
             </div>
           ))}
         </div>
      )}
    </div>
  );
}
