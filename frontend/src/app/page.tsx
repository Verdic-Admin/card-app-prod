import { Hero } from "@/components/Hero";
import { CardGrid } from "@/components/CardGrid";
import { createSupabaseClient } from "@/utils/supabase/client";

export const revalidate = 60;

export default async function Home() {
  const supabase = createSupabaseClient();
  
  const { data: items, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('status', 'available')
    .order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching available inventory:", error);
  }

  return (
    <div>
      <Hero />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Available Inventory</h2>
          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            {items?.length || 0} Cards
          </span>
        </div>
        
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            Failed to load inventory. Please try again later.
          </div>
        ) : (
          <CardGrid items={items || []} emptyMessage="No available cards at the moment. Check back soon!" />
        )}
      </div>
    </div>
  );
}
