import { CardGrid } from "@/components/CardGrid";
import pool, { hasUsableDatabaseUrl } from '@/utils/db';

export const revalidate = 60;

export default async function SoldPage() {
  let items: any[] = [];
  let error = false;
  if (!hasUsableDatabaseUrl) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">Past Sales</h1>
          <p className="text-muted text-lg">Browse our history of high-quality cards that have found new homes.</p>
        </div>
        <CardGrid items={[]} emptyMessage="No sold cards yet." />
      </div>
    );
  }
  try {
    const { rows } = await pool.query(`SELECT * FROM inventory WHERE status = 'sold' ORDER BY player_name ASC`);
    items = rows;
  } catch (err) {
    const e = err as { code?: string; hostname?: string };
    if (!(e?.code === 'ENOTFOUND' && e?.hostname === 'base')) {
      console.error("Error fetching sold inventory:", err);
    }
    error = true;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">Past Sales</h1>
        <p className="text-muted text-lg">Browse our history of high-quality cards that have found new homes.</p>
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
