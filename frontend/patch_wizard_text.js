const fs = require('fs');

let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const target = `{ title: "Step 1: High Quality Photography", content: "To ensure maximum scan accuracy across edge-to-edge Chrome borders, lay the card flat on a solid, non-reflective surface (e.g. black mat). Ensure lighting is ambient and prevents flash glare on the card surface." }`;
const replacement = `{ title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." }`;

if (c.includes(target)) {
   c = c.replace(target, replacement);
   fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
   console.log('Patched text!');
} else {
   console.log('Target not found.');
}
