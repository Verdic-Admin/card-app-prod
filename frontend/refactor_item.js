const fs = require('fs');

let content = fs.readFileSync('src/app/item/[id]/page.tsx', 'utf-8');

// Replace createClient
content = content.replace(/const supabase = await createClient\(\)\n/g, "");

content = content.replace(
`  const { data: item } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()`,
`  const { rows } = await sql\`SELECT * FROM inventory WHERE id = \${id}\`;
  const item = rows[0];`
);

content = content.replace(
`  const { data: item, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()`,
`  let item;
  let error;
  try {
     const { rows } = await sql\`SELECT * FROM inventory WHERE id = \${id}\`;
     item = rows[0];
  } catch(e) {
     error = e;
  }`
);

content = content.replace(
`    const { data: children } = await supabase
      .from('inventory')
      .select('*')
      .eq('lot_id', item.id)
      .eq('status', 'available')`,
`    const { rows: children } = await sql\`SELECT * FROM inventory WHERE lot_id = \${item.id} AND status = 'available'\`;`
);

content = content.replace(
`    const { data: lot } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', item.lot_id)
      .single()`,
`    const { rows: lotRows } = await sql\`SELECT * FROM inventory WHERE id = \${item.lot_id}\`;
    const lot = lotRows[0];`
);

fs.writeFileSync('src/app/item/[id]/page.tsx', content);
