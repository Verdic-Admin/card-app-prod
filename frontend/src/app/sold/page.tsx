import { CardGrid } from "@/components/CardGrid";
import { createSupabaseClient } from "@/utils/supabase/client";

export const revalidate = 60;

export default async function SoldPage() {
  const supabase = createSupabaseClient();
  
  const { data: items, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('status', 'sold')
    .order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching sold inventory:", error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Past Sales</h1>
        <p className="text-slate-500 text-lg">Browse our history of high-quality cards that have found new homes.</p>
      </div>
      
      {error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Failed to load inventory. Please try again later.
        </div>
      ) : (
        <CardGrid items={items || []} emptyMessage="No sold cards yet." />
      )}
    </div>
  );
}
