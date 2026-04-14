import Link from 'next/link'

interface MarketSparklineProps {
  data: number[];
  playerIndexUrl: string;
}

export function MarketSparkline({ data, playerIndexUrl }: MarketSparklineProps) {
  if (!data || data.length < 2) return null;

  const shopId = process.env.NEXT_PUBLIC_SHOP_ID || 'IndependentStore';
  const urlObj = playerIndexUrl !== '#' ? new URL(playerIndexUrl) : null;
  if (urlObj) {
    urlObj.searchParams.set('ref_name', shopId);
  }
  const finalUrl = urlObj ? urlObj.toString() : '#';

  const width = 60;
  const height = 20;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // points logic mapping array indices to x,y coords
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUp = data[data.length - 1] >= data[data.length - 2];
  const color = isUp ? '#10b981' : '#ef4444'; // emerald-500 : red-500

  return (
    <Link 
      href={finalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 group hover:opacity-80 transition-opacity ml-2"
      title={isUp ? "Trending Up" : "Trending Down"}
    >
      <svg 
         width={width} 
         height={height} 
         viewBox={`-1 -1 ${width + 2} ${height + 2}`} 
         fill="none"
         className="overflow-visible stroke-[2]"
         style={{ strokeDasharray: '400', strokeDashoffset: '0', animation: 'flow 2s ease-out forwards' }}
      >
        <polyline 
           points={points} 
           stroke={color} 
           strokeLinecap="round" 
           strokeLinejoin="round" 
        />
      </svg>
      <style>{`
        @keyframes flow {
           0% { stroke-dashoffset: 400; }
           100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </Link>
  );
}
