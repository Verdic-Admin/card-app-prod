const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/bg-zinc-950/g, 'bg-background');
    content = content.replace(/bg-zinc-900\/40/g, 'bg-surface/40');
    content = content.replace(/bg-zinc-900\/90/g, 'bg-surface/90');
    content = content.replace(/bg-zinc-900\/80/g, 'bg-surface/80');
    content = content.replace(/bg-zinc-900\/50/g, 'bg-surface/50');
    content = content.replace(/bg-zinc-900/g, 'bg-surface');
    content = content.replace(/hover:bg-zinc-900/g, 'hover:bg-surface');
    content = content.replace(/bg-zinc-800\/50/g, 'bg-surface-hover/50');
    content = content.replace(/bg-zinc-800/g, 'bg-surface-hover');
    content = content.replace(/hover:bg-zinc-800/g, 'hover:bg-surface-hover');
    content = content.replace(/border-zinc-800\/60/g, 'border-border/60');
    content = content.replace(/border-zinc-800\/50/g, 'border-border/50');
    content = content.replace(/border-zinc-800/g, 'border-border');
    content = content.replace(/border-zinc-700/g, 'border-border');
    content = content.replace(/text-zinc-400/g, 'text-muted');
    content = content.replace(/text-zinc-500/g, 'text-muted');
    content = content.replace(/text-zinc-600/g, 'text-muted');
    content = content.replace(/text-zinc-700/g, 'text-muted');
    content = content.replace(/text-zinc-300/g, 'text-foreground');
    content = content.replace(/text-white/g, 'text-foreground');
    fs.writeFileSync(path, content);
}

scrub('src/app/page.tsx');
scrub('src/components/FloatingCart.tsx');
scrub('src/components/TradeModal.tsx');
console.log('Other components scrubbed');
