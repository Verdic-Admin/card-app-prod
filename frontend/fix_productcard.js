const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // zinc
    content = content.replace(/bg-zinc-950\/80/g, 'bg-background/80');
    content = content.replace(/bg-zinc-950/g, 'bg-background');
    content = content.replace(/bg-zinc-900\/50/g, 'bg-surface/50');
    content = content.replace(/bg-zinc-900/g, 'bg-surface');
    content = content.replace(/hover:bg-zinc-800/g, 'hover:bg-surface-hover');
    content = content.replace(/hover:border-zinc-700/g, 'hover:border-muted');
    content = content.replace(/border-zinc-800/g, 'border-border');
    content = content.replace(/border-zinc-700/g, 'border-border');
    content = content.replace(/hover:border-zinc-500/g, 'hover:border-muted');
    content = content.replace(/border-zinc-200/g, 'border-border');
    
    content = content.replace(/text-zinc-600/g, 'text-muted');
    content = content.replace(/text-zinc-500/g, 'text-muted');
    content = content.replace(/text-zinc-300/g, 'text-foreground');
    content = content.replace(/text-zinc-950/g, 'text-background');

    // cyan
    content = content.replace(/text-cyan-400/g, 'text-brand-hover');
    content = content.replace(/text-cyan-300/g, 'text-brand');
    content = content.replace(/bg-cyan-900\/40/g, 'bg-brand/20');
    content = content.replace(/border-cyan-700\/50/g, 'border-brand/40');
    content = content.replace(/hover:text-cyan-400/g, 'hover:text-brand-hover');
    content = content.replace(/hover:bg-cyan-500/g, 'hover:bg-brand-hover');
    content = content.replace(/hover:border-cyan-500/g, 'hover:border-brand-hover');

    // slate
    content = content.replace(/text-slate-300/g, 'text-muted');
    content = content.replace(/bg-slate-800/g, 'bg-surface-hover');
    content = content.replace(/border-slate-700/g, 'border-border');

    fs.writeFileSync(path, content);
}

scrub('src/components/ProductCard.tsx');
console.log('ProductCard scrubbed for bleed');
