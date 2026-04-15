const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const target = `{ title: "Step 2: Layout & Capacity", content: "You can include up to 9 cards in each photo/scan. You must upload both the fronts and backs of the cards. CRITICAL: The fronts and backs MUST be placed in the exact same location in the image so the AI can map them together properly." }`;

const replacement = `{ title: "Step 2: Layout & Capacity", content: "You can include up to 9 cards in each photo/scan with at least an inch of space between each card. You must upload both the fronts and backs of the cards. CRITICAL: The fronts and backs MUST be placed in the exact same location in the image so the AI can map them together properly." }`;

if (c.includes(target)) {
   c = c.replace(target, replacement);
   fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
   console.log('Patched layout text with spacing info!');
} else {
   console.log('Target not found. Debugging:');
   console.log(c.substring(c.indexOf('steps={['), c.indexOf(']}', c.indexOf('steps={[')) + 2));
}
