const fs = require('fs');
let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');
if (!c.includes("'use client'")) {
    c = "'use client'\n" + c;
}
c = c.replace('</div>v>', '</div>');
fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
console.log('Fixed Wizard');
