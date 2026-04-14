const fs = require('fs');

const file = 'src/app/actions/oracleSync.ts';
let content = fs.readFileSync(file, 'utf-8');

// Replace createClient imports or calls
content = content.replace(/const supabase = await createClient\(\)\n/g, '');
content = content.replace(/import \{ createClient \} from '@\/utils\/supabase\/server'\n/g, '');

// Line 89 - 100
content = content.replace(/const \{ data: settings \} = await \(supabase as any\)\.from\('store_settings'\)\.select\('oracle_discount_percentage'\)\.eq\('id', 1\)\.single\(\)/g, "const { rows: settingsRows } = await sql`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`; const settings = settingsRows[0]");
content = content.replace(/const \{ data: item, error: inventoryError \} = await supabase\n\s*\.from\('inventory'\)\n\s*\.select\('\*'\)\n\s*\.eq\('id', id\)\n\s*\.single\(\)/g, "let item, inventoryError;\n  try {\n    const { rows } = await sql`SELECT * FROM inventory WHERE id = ${id}`\n    item = rows[0]\n  } catch (err) {\n    inventoryError = err\n  }");

content = content.replace(/const \{ error: updateError \} = await supabase\n\s*\.from\('inventory'\)\n\s*\/\/\s*@ts-ignore\n\s*.update\(\{\s*listed_price: new_price, oracle_projection: data\.target_price, oracle_trend_percentage: data\.trend_percentage \|\| null\s*\}\)\n\s*\.eq\('id', \(item as any\)\.id\)/g, "let updateError; try { await sql`UPDATE inventory SET listed_price = ${new_price}, oracle_projection = ${data.target_price}, oracle_trend_percentage = ${data.trend_percentage || null} WHERE id = ${item.id}` } catch (err) { updateError = err }");

content = content.replace(/const \{ data: item \} = await supabase\.from\('inventory'\)\.select\('oracle_projection'\)\.eq\('id', id\)\.single\(\)/g, "const { rows } = await sql`SELECT oracle_projection FROM inventory WHERE id = ${id}`; const item = rows[0];");

content = content.replace(/await \(supabase\.from\('inventory'\) as any\)\.update\(\{ listed_price: new_price \}\)\.eq\('id', id\)/g, "await sql`UPDATE inventory SET listed_price = ${new_price} WHERE id = ${id}`");

content = content.replace(/const \{ data: items \} = await \(supabase as any\)\.from\('inventory'\)\.select\('id, oracle_projection'\)\.not\('oracle_projection', 'is', null\)/g, "const { rows: items } = await sql`SELECT id, oracle_projection FROM inventory WHERE oracle_projection IS NOT NULL`");

content = content.replace(/await \(supabase\.from\('inventory'\) as any\)\.update\(\{ listed_price: new_price \}\)\.eq\('id', item\.id\)/g, "await sql`UPDATE inventory SET listed_price = ${new_price} WHERE id = ${item.id}`");

content = content.replace(/await \(supabase\.from\('inventory'\) as any\)\.update\(\{ \.\.\.item, needs_correction: false \}\)\.eq\('id', id\)/g, "/* TODO item keys */");
content = content.replace(/await \(supabase\.from\('inventory'\) as any\)\.update\(\{ listed_price: item\.listed_price, needs_price_approval: false \}\)\.eq\('id', id\)/g, "await sql`UPDATE inventory SET listed_price = ${item.listed_price}, needs_price_approval = false WHERE id = ${id}`");
content = content.replace(/await \(supabase\.from\('inventory'\) as any\)\.update\(\{ needs_correction: false, needs_price_approval: false \}\)\.eq\('id', id\)/g, "await sql`UPDATE inventory SET needs_correction = false, needs_price_approval = false WHERE id = ${id}`");

fs.writeFileSync(file, content);
