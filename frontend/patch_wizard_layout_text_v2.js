const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const target = `steps={[
                   { title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." },
                   { title: "Step 2: Understanding the API", content: "Once uploaded, your photos are sent to the Vision API queue. A background GPU node isolates the card structure (OCR padding) and measures visual sentiment before matching it against the historical Player Index to assign dynamic arbitrage models." },
                   { title: "Step 3: Verification & Editing", content: "Perfect matches land in your 'Ready to Commit' tab immediately. For cards missing taxonomy fields (due to glare or modern Mojo/Shimmer parallels being unlabeled on the card body), use the powerful taxonomy search in the Correction Queue to manually force a pricing match. Always rely on the dropdown index to ensure proper normalization." }
                ]}`;

const replacement = `steps={[
                   { title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." },
                   { title: "Step 2: Layout & Capacity", content: "You can include up to 9 cards in each photo/scan. You must upload both the fronts and backs of the cards. CRITICAL: The fronts and backs MUST be placed in the exact same location in the image so the AI can map them together properly." },
                   { title: "Step 3: Understanding the API", content: "Once uploaded, your photos are sent to the Vision API queue. A background GPU node aligns the front/back crops across the 9 card matrix, isolates the card structure, and matches it against the Player Index to assign dynamic arbitrage models." },
                   { title: "Step 4: Verification & Editing", content: "Perfect matches land in your 'Ready to Commit' tab immediately. For cards missing taxonomy fields (due to glare or Mojo/Shimmer parallels), use the taxonomy search in the Correction Queue to manually force a pricing match." }
                ]}`;

if (c.includes(target)) {
   c = c.replace(target, replacement);
   fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
   console.log('Patched layout text correctly this time!');
} else {
   console.log('Target still not found. Debugging:');
   console.log(c.substring(c.indexOf('steps={['), c.indexOf(']}', c.indexOf('steps={[')) + 2));
}
