const fs = require('fs');

let c = fs.readFileSync('src/components/admin/CoinRequestsCRM.tsx', 'utf8');

if (!c.includes('InstructionTrigger')) {
    const lastImportIndex = c.lastIndexOf('import ');
    let importEndIndex = c.indexOf('\n', lastImportIndex);
    if (lastImportIndex === -1) importEndIndex = 0;
    c = c.slice(0, importEndIndex + 1) + `import { InstructionTrigger } from '@/components/admin/DraggableGuide'` + '\n' + c.slice(importEndIndex + 1);
}

let target = `<span>dY",</span> Coin Requests Action Center`;
let replacement = `<span>dY",</span> Coin Requests Action Center
          <InstructionTrigger 
             title="Coin Requests Guide"
             steps={[
                { title: "What is Coining?", content: "In the hobby, 'coining' a card means proving you physically own it by taking a photo of the card next to a piece of paper with your name and today's date on it. Buyers who want to verify your inventory from any listing will submit requests." },
                { title: "Fulfillment", content: "When you receive a Coin Request here, snap a photo of the card with your physical 'coin' (name and date). Upload that photo directly into this CRM to securely notify the buyer and proceed with the transaction." }
             ]}
          />`;

c = c.replace(target, replacement);
fs.writeFileSync('src/components/admin/CoinRequestsCRM.tsx', c);
console.log('CRM patched');
