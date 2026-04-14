const fs = require('fs');

let content = fs.readFileSync('src/app/actions/inventory.ts', 'utf-8');

// deleteCardAction storage & DB deletion
content = content.replace(
`  if (imageUrl) {
    try {
      const urlObj = new URL(imageUrl)
      const pathParts = urlObj.pathname.split('/')
      const fileName = pathParts[pathParts.length - 1]
      
      if (fileName) {
        await admin.storage.from('card-images').remove([fileName])
      }
    } catch (e) {
      console.warn("Failed to delete image from storage:", e)
    }
  }

  const { error } = await admin.from('inventory').delete().eq('id', id)
  if (error) throw new Error(\`Delete failed: \${error.message}\`)`,
`  if (imageUrl) {
    try {
      await del(imageUrl);
    } catch (e) {
      console.warn("Failed to delete blob from vercel:", e)
    }
  }
  await sql\`DELETE FROM inventory WHERE id = \${id}\`;`
);

// bulkDeleteCardsAction
content = content.replace(
`  // 1. Delete all images from storage to prevent massive orphaned asset bills
  const fileNames = items
    .filter(i => i.image_url)
    .map(i => {
      try {
        const urlObj = new URL(i.image_url!)
        const pathParts = urlObj.pathname.split('/')
        return pathParts[pathParts.length - 1]
      } catch { return null }
    })
    .filter(Boolean) as string[]

  if (fileNames.length > 0) {
    await admin.storage.from('card-images').remove(fileNames)
  }

  // 2. Delete all records from DB in a single ultra-fast operation
  const ids = items.map(i => i.id)
  const { error } = await admin.from('inventory').delete().in('id', ids)
  
  if (error) throw new Error(\`Bulk delete failed: \${error.message}\`)`,
`  // 1. Delete all images from vercel blob
  const urls = items.filter(i => i.image_url).map(i => i.image_url!);
  if (urls.length > 0) {
    try { await del(urls); } catch(e) {}
  }

  // 2. Delete all records from DB in a single ultra-fast operation
  if (items.length > 0) {
      const ids = items.map(i => i.id);
      await sql\`DELETE FROM inventory WHERE id = ANY(\${ids as any}::uuid[])\`;
  }`
);

fs.writeFileSync('src/app/actions/inventory.ts', content);
