const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'docs', 'topps_taxonomy.md');
const outPath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'taxonomy.ts');

const md = fs.readFileSync(mdPath, 'utf8');
const escapedMd = md.replace(/`/g, '\\`').replace(/\$/g, '\\$');

const tsContent = `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n// Edit docs/topps_taxonomy.md instead, then run node build_taxonomy.js\n\nexport const TOPPS_TAXONOMY = \`\n${escapedMd}\n\`;\n`;

fs.writeFileSync(outPath, tsContent);
console.log('Successfully bundled topps_taxonomy.md into src/utils/taxonomy.ts');
