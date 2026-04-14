const fs = require('fs');

let content = fs.readFileSync('src/app/actions/inventory.ts', 'utf-8');

// bulkUpdateMetricsAction
content = content.replace(
`  const { error } = await admin.from('inventory').update({
    cost_basis: costBasis,
    accepts_offers: acceptsOffers
  }).in('id', ids)
  
  if (error) throw new Error(\`Bulk update failed: \${error.message}\`)`,
`  if (ids.length > 0) {
    await sql\`UPDATE inventory SET cost_basis = \${costBasis}, accepts_offers = \${acceptsOffers} WHERE id = ANY(\${ids as any}::uuid[])\`;
  }`
);

// rotateCardImageAction
content = content.replace(
`  // Fetch the current record so we can delete the old storage file
  const { data: record } = await (admin.from('inventory') as any)
    .select('image_url, back_image_url')
    .eq('id', id)
    .single()

  const oldUrl: string | null = side === 'front' ? record?.image_url : record?.back_image_url

  // Delete old file from storage (best-effort)
  if (oldUrl) {
    try {
      const parts = new URL(oldUrl).pathname.split('/')
      const oldName = parts[parts.length - 1]
      if (oldName) {
         const { error: removeError } = await admin.storage.from('card-images').remove([oldName])
         if (removeError) console.error("Failed to cleanly delete rotated old image:", removeError.message)
      }
    } catch (e: any) { console.error("Failed to cleanly delete rotated old image:", e.message) }
  }

  // Upload rotated file
  const ext = newFile.name.split('.').pop() || 'jpg'
  const prefix = side === 'back' ? 'back-rotated' : 'rotated'
  const newName = \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`
  const { error: uploadError } = await admin.storage.from('card-images').upload(newName, newFile)
  if (uploadError) throw new Error(\`Upload failed: \${uploadError.message}\`)

  const { data: urlData } = admin.storage.from('card-images').getPublicUrl(newName)
  const newUrl = urlData.publicUrl

  const field = side === 'front' ? 'image_url' : 'back_image_url'
  const { error: dbError } = await (admin.from('inventory') as any)
    .update({ [field]: newUrl })
    .eq('id', id)
  if (dbError) throw new Error(\`DB update failed: \${dbError.message}\`)`,
`  // Fetch the current record so we can delete the old storage file
  const { rows: records } = await sql\`SELECT image_url, back_image_url FROM inventory WHERE id = \${id}\`;
  const record = records[0];

  const oldUrl: string | null = side === 'front' ? record?.image_url : record?.back_image_url;

  // Delete old file from storage (best-effort)
  if (oldUrl) {
    try {
      await del(oldUrl);
    } catch (e: any) { console.error("Failed to cleanly delete rotated old image:", e.message) }
  }

  // Upload rotated file
  const ext = newFile.name.split('.').pop() || 'jpg';
  const prefix = side === 'back' ? 'back-rotated' : 'rotated';
  const newName = \`card-images/\${prefix}-\${Date.now()}-\${Math.random().toString(36).substring(7)}.\${ext}\`;
  
  const blob = await put(newName, newFile, { access: 'public' });
  const newUrl = blob.url;

  if (side === 'front') {
      await sql\`UPDATE inventory SET image_url = \${newUrl} WHERE id = \${id}\`;
  } else {
      await sql\`UPDATE inventory SET back_image_url = \${newUrl} WHERE id = \${id}\`;
  }`
);

fs.writeFileSync('src/app/actions/inventory.ts', content);
