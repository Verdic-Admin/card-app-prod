const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/text-cyan-500/g, 'text-brand');
    content = content.replace(/text-cyan-400/g, 'text-brand-hover');
    content = content.replace(/text-cyan-600/g, 'text-brand');
    content = content.replace(/bg-cyan-700/g, 'bg-brand-hover border-transparent');
    content = content.replace(/border-cyan-500/g, 'border-brand');
    content = content.replace(/bg-cyan-600/g, 'bg-brand');
    content = content.replace(/hover:bg-cyan-500/g, 'hover:bg-brand-hover');
    content = content.replace(/bg-cyan-500/g, 'bg-brand');
    content = content.replace(/bg-cyan-950\/10/g, 'bg-transparent');
    content = content.replace(/border-cyan-900\/20/g, 'border-brand/40');
    content = content.replace(/text-zinc-950 font-black/g, 'text-white font-black');
    fs.writeFileSync(path, content);
}

scrub('src/components/CartDrawer.tsx');
scrub('src/components/FloatingCart.tsx');
scrub('src/app/page.tsx');
console.log('Brand colors scrubbed');
