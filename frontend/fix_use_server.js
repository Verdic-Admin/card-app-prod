const fs = require('fs');
const path = require('path');
const dir = './src/app/actions';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    const p = path.join(dir, file);
    let c = fs.readFileSync(p, 'utf8');
    if (c.includes('use server')) {
      c = c.replace(/[\"']use server[\"'];?\r?\n/gi, '');
      c = '"use server";\n' + c;
      fs.writeFileSync(p, c);
    }
  }
});
