const fs = require('fs');

let content = fs.readFileSync('src/app/actions/inventory.ts', 'utf-8');

// createLotAction
content = content.replace(
`  // 1. Sum cost_basis of all child cards
  const { data: children, error: fetchErr } = await (admin.from('inventory') as any)
    .select('cost_basis')
    .in('id', itemIds)
  if (fetchErr) throw new Error(\`Failed to fetch children: \${fetchErr.message}\`)

  const totalCostBasis = (children as any[]).reduce(
    (sum: number, c: any) => sum + Number(c.cost_basis ?? 0),
    0
  )

  // 2. Insert the parent Lot row
  const { data: lot, error: insertErr } = await (admin.from('inventory') as any)
    .insert({
      player_name: lotTitle,
      listed_price: lotPrice,
      avg_price: lotPrice,
      cost_basis: totalCostBasis,
      is_lot: true,
      accepts_offers: false,
      status: 'available',
    })
    .select('id')
    .single()

  if (insertErr || !lot) throw new Error(\`Failed to create lot: \${insertErr?.message}\`)

  // 3. Link child cards to this lot
  const { error: linkErr } = await (admin.from('inventory') as any)
    .update({ lot_id: lot.id })
    .in('id', itemIds)
  if (linkErr) throw new Error(\`Failed to link children: \${linkErr.message}\`)`,
`  // 1. Sum cost_basis of all child cards
  const { rows: children } = await sql\`SELECT cost_basis FROM inventory WHERE id = ANY(\${itemIds as any}::uuid[])\`;

  const totalCostBasis = children.reduce(
    (sum: number, c: any) => sum + Number(c.cost_basis ?? 0),
    0
  )

  // 2. Insert the parent Lot row
  const { rows } = await sql\`
      INSERT INTO inventory (player_name, listed_price, avg_price, cost_basis, is_lot, accepts_offers, status)
      VALUES (\${lotTitle}, \${lotPrice}, \${lotPrice}, \${totalCostBasis}, true, false, 'available')
      RETURNING id
  \`;
  const lotId = rows[0].id;

  // 3. Link child cards to this lot
  await sql\`UPDATE inventory SET lot_id = \${lotId} WHERE id = ANY(\${itemIds as any}::uuid[])\`;`
);

// updateLiveStreamUrl
content = content.replace(
`  await (admin.from('store_settings') as any).update({ live_stream_url: url }).eq('id', 1)`,
`  await sql\`UPDATE store_settings SET live_stream_url = \${url} WHERE id = 1\`;`
);

// updateProjectionTimeframe
content = content.replace(
`  await (admin.from('store_settings') as any).update({ projection_timeframe: timeframe }).eq('id', 1)`,
`  await sql\`UPDATE store_settings SET projection_timeframe = \${timeframe} WHERE id = 1\`;`
);

// sendToAuctionBlock
content = content.replace(
`  await (admin.from('inventory') as any).update({ is_auction: true, auction_status: 'pending' }).in('id', ids)`,
`  if (ids.length > 0) {
    await sql\`UPDATE inventory SET is_auction = true, auction_status = 'pending' WHERE id = ANY(\${ids as any}::uuid[])\`;
  }`
);

// updateStagedAuction
content = content.replace(
`  const payload: any = {}
  if (reservePrice !== undefined) payload.auction_reserve_price = reservePrice
  if (endTime !== undefined) payload.auction_end_time = endTime
  if (description !== undefined) payload.auction_description = description
  if (coinedImageUrl !== undefined) payload.coined_image_url = coinedImageUrl
  
  await (admin.from('inventory') as any).update(payload).eq('id', itemId)`,
`  
  if (reservePrice !== undefined) await sql\`UPDATE inventory SET auction_reserve_price = \${reservePrice} WHERE id = \${itemId}\`;
  if (endTime !== undefined) await sql\`UPDATE inventory SET auction_end_time = \${endTime} WHERE id = \${itemId}\`;
  if (description !== undefined) await sql\`UPDATE inventory SET auction_description = \${description} WHERE id = \${itemId}\`;
  if (coinedImageUrl !== undefined) await sql\`UPDATE inventory SET coined_image_url = \${coinedImageUrl} WHERE id = \${itemId}\`;`
);

// goLiveWithAuctions
content = content.replace(
`  await (admin.from('inventory') as any).update({ auction_status: 'live' }).in('id', itemIds)`,
`  if (itemIds.length > 0) {
    await sql\`UPDATE inventory SET auction_status = 'live' WHERE id = ANY(\${itemIds as any}::uuid[])\`;
  }`
);

// generateBatchCodes
content = content.replace(
`  for (const id of ids) {
    const code = \`PI-\${Math.floor(1000 + Math.random() * 9000)}\`
    await (admin.from('inventory') as any).update({ verification_code: code }).eq('id', id)
  }`,
`  for (const id of ids) {
    const code = \`PI-\${Math.floor(1000 + Math.random() * 9000)}\`
    await sql\`UPDATE inventory SET verification_code = \${code} WHERE id = \${id}\`;
  }`
);

// uploadVerifiedFlipUI
content = content.replace(
`  const { error: uploadError } = await admin.storage.from('card-images').upload(fileName, file)
  if (uploadError) throw new Error('Upload failed')
  const { data: urlData } = admin.storage.from('card-images').getPublicUrl(fileName)
  
  await (admin.from('inventory') as any).update({
    video_url: urlData.publicUrl,
    is_verified_flip: true
  }).eq('id', id)`,
`  const blob = await put(\`card-images/\${fileName}\`, file, { access: 'public' });
  await sql\`UPDATE inventory SET video_url = \${blob.url}, is_verified_flip = true WHERE id = \${id}\`;`
);

// removeFromAuctionBlock
content = content.replace(
`  await (admin.from('inventory') as any).update({ is_auction: false, auction_status: 'pending' }).eq('id', id)`,
`  await sql\`UPDATE inventory SET is_auction = false, auction_status = 'pending' WHERE id = \${id}\`;`
);

// setAuctionStatus
content = content.replace(
`  await (admin.from('inventory') as any).update({ auction_status: status }).eq('id', id)`,
`  await sql\`UPDATE inventory SET auction_status = \${status} WHERE id = \${id}\`;`
);


fs.writeFileSync('src/app/actions/inventory.ts', content);
