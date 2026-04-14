const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf-8');

content = content.replace(
`  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*')
    .order('player_name', { ascending: true })

  // Fetch Oracle discount percentage and stream settings
  const { data: settings } = await (supabase as any)
    .from('store_settings')
    .select('oracle_discount_percentage, live_stream_url, projection_timeframe')
    .eq('id', 1)
    .single()`,
`  const { rows: inventory } = await sql\`SELECT * FROM inventory ORDER BY player_name ASC\`;

  // Fetch Oracle discount percentage and stream settings
  const { rows: storeRows } = await sql\`SELECT oracle_discount_percentage, live_stream_url, projection_timeframe FROM store_settings WHERE id = 1\`;
  const settings = storeRows[0];`
);

fs.writeFileSync('src/app/admin/page.tsx', content);
