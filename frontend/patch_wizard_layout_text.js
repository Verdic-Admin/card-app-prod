const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const target = `steps={[
                { title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." },
                { title: "Step 2: AI Orchestration", content: "Once uploaded, the Edge network distributes the images to specialized Vision AI workers. These workers isolate each card, perform OCR against the taxonomy, and auto-detect subsets." },
                { title: "Step 3: Verification", content: "The Local Correction Queue allows you to quickly fix any typos or unrecognized sets before mass-publishing the batch to your global inventory." }
             ]}`;

const replacement = `steps={[
                { title: "Step 1: Scans & Photographs", content: "To ensure maximum OCR accuracy, use clear scans or photographs. A bright green background works best, as long as the background is non-reflective and the card stands out cleanly against it. Always ensure lighting prevents flash glare on the card surface." },
                { title: "Step 2: Layout & Capacity", content: "You can include up to 9 cards in each photo/scan. You must upload both the fronts and backs of the cards. CRITICAL: The fronts and backs MUST be placed in the exact same location in the image so the AI can map them together properly." },
                { title: "Step 3: AI Orchestration", content: "Once uploaded, the Edge network distributes the images to specialized Vision AI workers. These workers align the front/back crops, isolate each card, perform OCR against the taxonomy, and auto-detect subsets." },
                { title: "Step 4: Verification", content: "The Local Correction Queue allows you to quickly fix any typos or unrecognized sets before mass-publishing the batch to your global inventory." }
             ]}`;

if (c.includes(target)) {
   c = c.replace(target, replacement);
   fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
   console.log('Patched layout text!');
} else {
   console.log('Target not found. Looking at what is there instead:');
   console.log(c.substring(c.indexOf('steps={['), c.indexOf(']}', c.indexOf('steps={[')) + 2));
}
