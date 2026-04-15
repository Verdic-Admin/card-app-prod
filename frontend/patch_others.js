const fs = require('fs');

function patchFile(filepath, targetMatch, importStatement, replacement) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (!content.includes('InstructionTrigger')) {
        const lastImportIndex = content.lastIndexOf('import ');
        let importEndIndex = content.indexOf('\n', lastImportIndex);
        if (lastImportIndex === -1) importEndIndex = 0;
        content = content.slice(0, importEndIndex + 1) + importStatement + '\n' + content.slice(importEndIndex + 1);
    }
    
    if (content.includes(targetMatch)) {
         content = content.replace(targetMatch, replacement);
         fs.writeFileSync(filepath, content);
         console.log('Patched', filepath);
    } else {
         console.log('Match not found in', filepath);
    }
}

// 1. Inventory Database in admin/page.tsx
patchFile(
   'src/app/admin/page.tsx',
   `             <span>Live Inventory Database</span>`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `             <span className="flex items-center gap-2">
                Live Inventory Database
                <InstructionTrigger 
                   title="Inventory CRM Instructions"
                   steps={[
                      { title: "Pricing Engine Rules", content: "The background Oracle constantly recalculates values based on incoming metadata. Adjust your Target Percentage in settings to adapt your inventory." },
                      { title: "Mass Categorization", content: "If you need to rapidly label players for upcoming searches, bulk select them using the left-hand checkboxes and assign standardized taxonomies." }
                   ]}
                />
             </span>`
);

// 2. Settings Page
patchFile(
   'src/app/admin/settings/page.tsx',
   `<h1 className="text-3xl font-extrabold tracking-tight text-foreground">Store Operations</h1>`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `<div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Store Operations</h1>
            <InstructionTrigger 
              title="Store Operations Policy"
              steps={[
                 { title: "Discount Percentage", content: "This parameter controls your direct-to-buyer pricing structure." },
                 { title: "Payment Routing", content: "Leaving payment links blank dynamically hides those options from the checkout funnel. We recommend activating Venmo and CashApp strictly, as PayPal incurs commercial merchant fees." }
              ]}
            />
          </div>`
);

console.log('Patch complete');
