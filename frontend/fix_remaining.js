const fs = require('fs');
const path = require('path');

const directoryPath = 'src/app';

const replaceMap = [
    // Backgrounds
    { regex: /bg-white/g, replacement: 'bg-surface' },
    { regex: /bg-slate-50/g, replacement: 'bg-surface' },
    { regex: /bg-zinc-950/g, replacement: 'bg-background' },
    { regex: /bg-zinc-900/g, replacement: 'bg-surface' },
    { regex: /bg-zinc-800/g, replacement: 'bg-surface md:bg-surface-hover' },
    
    // Borders
    { regex: /border-slate-100/g, replacement: 'border-border' },
    { regex: /border-slate-200(\/60)?/g, replacement: 'border-border' },
    { regex: /border-slate-300/g, replacement: 'border-border' },
    { regex: /border-zinc-800/g, replacement: 'border-border' },
    { regex: /border-zinc-700/g, replacement: 'border-border' },

    // Text Colors - Foreground
    { regex: /text-slate-900/g, replacement: 'text-foreground' },
    { regex: /text-slate-800/g, replacement: 'text-foreground' },
    { regex: /text-zinc-950/g, replacement: 'text-foreground' },
    { regex: /text-zinc-200/g, replacement: 'text-foreground' },
    { regex: /text-zinc-300/g, replacement: 'text-foreground' },
    
    // Text Colors - Muted
    { regex: /text-slate-700/g, replacement: 'text-muted' },
    { regex: /text-slate-600/g, replacement: 'text-muted' },
    { regex: /text-slate-500/g, replacement: 'text-muted' },
    { regex: /text-slate-400/g, replacement: 'text-muted' },
    { regex: /text-zinc-400/g, replacement: 'text-muted' },
    { regex: /text-zinc-500/g, replacement: 'text-muted' },
    
    // Brand overrides
    { regex: /bg-cyan-500/g, replacement: 'bg-brand' },
    { regex: /hover:bg-cyan-400/g, replacement: 'hover:bg-brand-hover' },
    { regex: /text-cyan-400/g, replacement: 'text-brand' },
    { regex: /group-hover:text-cyan-400/g, replacement: 'group-hover:text-brand' },
    { regex: /group-hover:border-cyan-900\/60/g, replacement: 'group-hover:border-brand/60' },
    { regex: /hover:border-cyan-900\/70/g, replacement: 'hover:border-brand/70' }
];

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    const ext = path.extname(filePath);
    if (!['.tsx', '.ts'].includes(ext)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    replaceMap.forEach(rule => {
        content = content.replace(rule.regex, rule.replacement);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

function processDirectory(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else {
            processFile(fullPath);
        }
    });
}

processDirectory(directoryPath);
console.log('Complete.');
