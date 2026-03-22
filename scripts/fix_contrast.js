const fs = require('fs');
const files = [
  'frontend/src/components/TradeModal.tsx',
  'frontend/src/components/StoreFilters.tsx',
  'frontend/src/components/ProductCard.tsx',
  'frontend/src/components/CartDrawer.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Boost all secondary/tertiary typography brightness against dark backgrounds
  content = content.replace(/text-zinc-700/g, 'text-zinc-400');
  content = content.replace(/text-zinc-600/g, 'text-zinc-400');
  content = content.replace(/text-zinc-500/g, 'text-zinc-300');
  fs.writeFileSync(f, content);
});
console.log('Contrast globally boosted.');
