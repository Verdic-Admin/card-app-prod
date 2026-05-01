import { Database } from '@/types/database.types';
import { ProductCard } from './ProductCard';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

interface CardGridProps {
  items: InventoryItem[];
  discountRate?: number;
  emptyMessage?: string;
}

export function CardGrid({ items, discountRate = 0, emptyMessage = "No cards found." }: CardGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-slate-500 font-medium">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} discountRate={discountRate} />
      ))}
    </div>
  );
}
