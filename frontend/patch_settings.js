const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (!content.includes('InstructionTrigger')) {
        const lastImportIndex = content.lastIndexOf('import ');
        let importEndIndex = content.indexOf('\n', lastImportIndex);
        if (lastImportIndex === -1) importEndIndex = 0;
        content = content.slice(0, importEndIndex + 1) + `import { InstructionTrigger } from '@/components/admin/DraggableGuide'` + '\n' + content.slice(importEndIndex + 1);
    }
    
    let target1 = `<h1 className="text-2xl font-black text-foreground tracking-tight">Global Store Settings</h1>`;
    if (content.includes(target1)) {
         content = content.replace(target1, `<h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Global Store Settings
            <InstructionTrigger 
              title="Store Operations Policy"
              steps={[
                 { title: "Discount Percentage", content: "This parameter controls your direct-to-buyer pricing structure. It overrides the specific settings." },
                 { title: "Payment Routing", content: "Leaving payment links blank dynamically hides those options from the checkout funnel. We recommend activating Venmo and CashApp strictly, as PayPal incurs commercial merchant fees." }
              ]}
            />
        </h1>`);
         fs.writeFileSync(filepath, content);
         console.log('Patched', filepath);
    } else {
         console.log('Match not found in', filepath);
    }
}

patchFile('src/app/admin/settings/page.tsx');
