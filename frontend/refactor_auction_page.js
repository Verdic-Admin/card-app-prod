const fs = require('fs');

let content = fs.readFileSync('src/app/auction/page.tsx', 'utf-8');

content = content.replace(
`  const supabase = await createClient()

  const { data: settings } = await (supabase as any)
    .from('store_settings')
    .select('live_stream_url')
    .eq('id', 1)
    .single()`,
`  const { rows: storeRows } = await sql\`SELECT live_stream_url FROM store_settings WHERE id = 1\`;
  const settings = storeRows[0];`
);

content = content.replace(
`  const { data: items } = await (supabase as any)
    .from('inventory')
    .select('*')
    .eq('is_auction', true)
    .eq('auction_status', 'live')
    .order('player_name', { ascending: true })`,
`  const { rows: items } = await sql\`SELECT * FROM inventory WHERE is_auction = true AND auction_status = 'live' ORDER BY player_name ASC\`;`
);

fs.writeFileSync('src/app/auction/page.tsx', content);
