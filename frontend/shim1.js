const fs = require('fs');
const glob = require('glob'); // Not available by default, I'll use fs.readdirSync recursively or just a fixed list

const files = [
  'src/app/page.tsx',
  'src/app/item/[id]/page.tsx',
  'src/app/auction/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/auction-studio/page.tsx',
  'src/app/actions/trades.ts',
  'src/app/actions/settings.ts',
  'src/app/actions/oracleSync.ts',
  'src/app/actions/drafts.ts',
  'src/app/actions/coins.ts',
  'src/app/actions/checkout.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');

  // Insert import { sql } if needed
  if (!content.includes('@vercel/postgres')) {
     content = `import { sql } from '@vercel/postgres';\n` + content;
  }

  // Remove supabase import
  content = content.replace(/import\s*\{\s*createClient[^\}]*?\s*\}\s*from\s*['"]@\/utils\/supabase\/server['"];?\n?/g, '');
  content = content.replace(/import\s*createClient\s*from\s*['"]@\/utils\/supabase\/server['"];?\n?/g, '');

  fs.writeFileSync(file, content);
}
