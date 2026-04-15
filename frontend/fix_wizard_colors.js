const fs = require('fs');

let c = fs.readFileSync('src/components/admin/BulkIngestionWizard.tsx', 'utf8');

const replacements = [
    // Step 1
    ['text-slate-700', 'text-foreground'],
    ['border-indigo-200', 'border-brand/30'],
    ['bg-indigo-50/30', 'bg-brand/5'],
    ['hover:bg-slate-50', 'hover:bg-surface-hover'],
    ['text-indigo-400', 'text-brand/70'],
    ['text-indigo-700', 'text-brand'],
    ['bg-indigo-600 hover:bg-indigo-700 text-white', 'bg-brand hover:bg-brand-hover text-brand-foreground'],
    ['bg-indigo-600', 'bg-brand'], // remaining bg-indigo-600
    ['hover:bg-indigo-700', 'hover:bg-brand-hover'],

    // Step 2
    ['text-slate-900', 'text-foreground'],
    ['text-slate-500', 'text-muted'],
    
    // Step 3
    ['bg-emerald-100', 'bg-emerald-500/20'],
    ['text-emerald-800', 'text-emerald-500'],
    ['bg-white border-2', 'bg-surface border-2'], // to prevent wiping generic styling
    ['bg-white', 'bg-surface'],
    ['bg-amber-100', 'bg-amber-500/20'],
    ['text-amber-800', 'text-amber-500'],
    ['text-slate-400', 'text-muted'],
    ['text-white', 'text-background']
];

replacements.forEach(([from, to]) => {
    c = c.split(from).join(to);
});

fs.writeFileSync('src/components/admin/BulkIngestionWizard.tsx', c);
console.log('Wizard colors patched!');
