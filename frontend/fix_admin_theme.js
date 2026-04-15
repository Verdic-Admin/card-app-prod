const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');

    // General Backgrounds and Borders
    content = content.replace(/bg-white/g, 'bg-surface');
    content = content.replace(/bg-slate-50/g, 'bg-surface md:bg-surface-hover');
    content = content.replace(/border-slate-100/g, 'border-border');
    content = content.replace(/border-slate-200(\/60)?/g, 'border-border');
    content = content.replace(/border-slate-300/g, 'border-border md:border-muted/30');
    
    // Status box backgrounds specifically
    content = content.replace(/bg-indigo-50/g, 'bg-brand/10');
    content = content.replace(/border-indigo-100/g, 'border-brand/20');
    content = content.replace(/bg-blue-50\/50/g, 'bg-surface');
    content = content.replace(/border-blue-100/g, 'border-border');
    
    // Buttons & Toggles
    content = content.replace(/bg-slate-900/g, 'bg-foreground');
    content = content.replace(/text-slate-900/g, 'text-background'); // Special for buttons if bg-slate-900 was actually foreground
    content = content.replace(/bg-slate-200/g, 'bg-muted');

    // Text Colors
    content = content.replace(/text-slate-900/g, 'text-foreground');
    content = content.replace(/text-slate-800/g, 'text-foreground');
    content = content.replace(/text-slate-700/g, 'text-foreground md:text-muted');
    content = content.replace(/text-slate-600/g, 'text-muted');
    content = content.replace(/text-slate-500/g, 'text-muted');
    content = content.replace(/text-slate-400/g, 'text-muted/60');
    content = content.replace(/text-slate-300/g, 'text-muted/40');
    
    // Brand Colors
    content = content.replace(/text-indigo-600/g, 'text-brand');
    content = content.replace(/text-indigo-800/g, 'text-brand-hover');
    content = content.replace(/text-violet-700/g, 'text-brand');
    content = content.replace(/bg-violet-100/g, 'bg-brand/20');
    content = content.replace(/focus:ring-violet-500/g, 'focus:ring-brand');
    content = content.replace(/focus:border-violet-500/g, 'focus:border-brand');
    content = content.replace(/focus:ring-indigo-500/g, 'focus:ring-brand');
    content = content.replace(/focus:border-indigo-500/g, 'focus:border-brand');
    content = content.replace(/bg-indigo-500/g, 'bg-brand');
    content = content.replace(/bg-indigo-400/g, 'bg-brand/80');
    content = content.replace(/hover:text-indigo-800/g, 'hover:opacity-80 text-brand');
    content = content.replace(/hover:bg-indigo-600/g, 'hover:opacity-80 bg-brand');
    
    // Special fix for the Force Update settings button
    content = content.replace(/bg-foreground hover:opacity-80 bg-brand/g, 'bg-foreground hover:bg-brand');

    fs.writeFileSync(path, content);
}

scrub('src/app/admin/design/page.tsx');
scrub('src/app/admin/settings/page.tsx');
console.log('Admin pages themified');
