const fs = require('fs');

function scrub(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // Quick swap back to foreground to prevent background-colored text bleeding out!
    content = content.replace(/text-background/g, 'text-foreground');
    
    fs.writeFileSync(path, content);
}

scrub('src/app/admin/design/page.tsx');
scrub('src/app/admin/settings/page.tsx');
console.log('Text fixed');
