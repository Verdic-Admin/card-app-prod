const fs = require('fs');

let content = fs.readFileSync('src/app/actions/inventory.ts', 'utf-8');

// Replace standard auth blocks
const authBlockRegex1 = /const supabase = await createClient\(\)\n\s+const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\)\n\s+if \(!user\) throw new Error\(['"]Unauthorized['"]\)\n/g;
content = content.replace(authBlockRegex1, 'checkAuth();\n');

const adminBlockRegex = /const admin = createAdminClient\(\)\n/g;
content = content.replace(adminBlockRegex, '');

// Save it back
fs.writeFileSync('src/app/actions/inventory.ts', content);
