const fs = require('fs');

const files = [
  'src/app/actions/checkout.ts',
  'src/app/actions/drafts.ts',
  'src/app/actions/trades.ts',
  'src/app/actions/settings.ts',
  'src/app/actions/inventory.ts',
  'src/app/actions/oracleSync.ts',
  'src/app/page.tsx',
  'src/app/auction/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/item/[id]/page.tsx',
  'src/app/admin/auction-studio/page.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  let newContent = content.replace(/sql\\\`/g, 'sql`');
  newContent = newContent.replace(/\\\`;/g, '`;');
  newContent = newContent.replace(/\\\`\n/g, '`\n');
  newContent = newContent.replace(/\\\${/g, '${');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log("Fixed " + file);
  }
}
