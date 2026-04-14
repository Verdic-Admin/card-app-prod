import { CardGrid } from "@/components/CardGrid";
import { sql } from "@vercel/postgres";

export const revalidate = 60;

export default async function SoldPage() {
  let items: any[] = [];
  let error = false;
  try {
    const { rows } = await sql`SELECT * FROM inventory WHERE status = 'sold' ORDER BY player_name ASC`;
    items = rows;
  } catch (err) {
    console.error("Error fetching sold inventory:", err);
    error = true;
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
