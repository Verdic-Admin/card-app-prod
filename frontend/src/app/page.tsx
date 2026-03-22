import { Hero } from "@/components/Hero";
import { CardGrid } from "@/components/CardGrid";
import { createClient } from "@/utils/supabase/server";
import { StoreFilters } from "@/components/StoreFilters";

export default async function Home(props: { searchParams: Promise<{ [key: string]: string | undefined }> | any }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  // 1. Dynamically extract the highly precise lists of available teams and years that actually exist in the DB right now
  const { data: filterData } = await supabase
    .from('inventory')
    .select('team_name, year')
    .eq('status', 'available')
  
  const availableTeams = Array.from(new Set(filterData?.map((d: any) => d.team_name).filter(Boolean) as string[])).sort()
  const availableYears = Array.from(new Set(filterData?.map((d: any) => d.year).filter(Boolean) as string[])).sort((a,b) => b.localeCompare(a))

  // 2. Base Query Builder using Next.js pure SearchParams to natively enable shareable Deep Links instantly
  let query = supabase.from('inventory').select('*').eq('status', 'available')

  if (searchParams?.q) {
      query = query.or(`player_name.ilike.%${searchParams.q}%,team_name.ilike.%${searchParams.q}%,card_set.ilike.%${searchParams.q}%`)
  }
  if (searchParams?.team) {
      query = query.ilike('team_name', searchParams.team)
  }
  if (searchParams?.year) {
      query = query.eq('year', searchParams.year)
  }
  if (searchParams?.minPrice) {
      query = query.gte('listed_price', searchParams.minPrice)
  }
  if (searchParams?.maxPrice) {
      query = query.lte('listed_price', searchParams.maxPrice)
  }

  const { data: items, error } = await query.order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching available inventory:", error);
  }

  return (
    <div>
      <Hero />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 flex flex-col lg:flex-row items-start gap-8">
        
        <StoreFilters availableTeams={availableTeams} availableYears={availableYears} />

        <div className="flex-1 w-full min-w-0">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Available Inventory</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              {items?.length || 0} Cards
            </span>
          </div>
          
          {error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              Failed to load inventory. Please try again later.
            </div>
          ) : (
            <CardGrid items={items || []} emptyMessage="Zero cards match those filters. Try clearing your search!" />
          )}
        </div>
      </div>
    </div>
  );
}
