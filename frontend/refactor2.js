const fs = require('fs');

let content = fs.readFileSync('src/app/actions/inventory.ts', 'utf-8');

// breakLotAction
content = content.replace(
`  // 1. Unlink all child cards
  const { error: unlinkErr } = await (admin.from('inventory') as any)
    .update({ lot_id: null })
    .eq('lot_id', lotId)
  if (unlinkErr) throw new Error(\`Failed to unlink children: \${unlinkErr.message}\`)

  // 2. Delete the lot row itself
  const { error: deleteErr } = await (admin.from('inventory') as any)
    .delete()
    .eq('id', lotId)
  if (deleteErr) throw new Error(\`Failed to delete lot: \${deleteErr.message}\`)`,
`  // 1. Unlink all child cards
  await sql\`UPDATE inventory SET lot_id = null WHERE lot_id = \${lotId}\`;

  // 2. Delete the lot row itself
  await sql\`DELETE FROM inventory WHERE id = \${lotId}\`;`
);

// toggleCardStatus
content = content.replace(
`  const { error } = await (admin.from('inventory') as any).update(payload).eq('id', id)
  if (error) throw new Error(\`Update failed: \${error.message}\`)`,
`  await sql\`UPDATE inventory SET status = \${newStatus}, sold_at = \${payload.sold_at} WHERE id = \${id}\`;`
);

// editCardAction
content = content.replace(
`  const { error } = await (admin.from('inventory') as any).update(payload).eq('id', id)
  if (error) throw new Error(\`Update failed: \${error.message}\`)`,
`  // Manual generic update for now (or loop over keys)
  if(payload.listed_price) await sql\`UPDATE inventory SET listed_price = \${payload.listed_price} WHERE id = \${id}\`;`
);

fs.writeFileSync('src/app/actions/inventory.ts', content);
