const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Replace createClient and supabase queries
content = content.replace(
`  const supabase = await createClient();`, ``
);

content = content.replace(
`  // 1. Dynamically extract the highly precise lists of available teams and years that actually exist in the DB right now
  const { data: filterData } = await supabase
    .from('inventory')
    .select('team_name')
    .eq('status', 'available')
  
  const availableTeams = Array.from(new Set(filterData?.map((d: any) => d.team_name).filter(Boolean) as string[])).sort()

  // 2. Base Query Builder using Next.js pure SearchParams to natively enable shareable Deep Links instantly
  let query = supabase.from('inventory').select('*').eq('status', 'available')

  if (searchParams?.q) {
      query = query.or(\`player_name.ilike.%\${searchParams.q}%,team_name.ilike.%\${searchParams.q}%,card_set.ilike.%\${searchParams.q}%\`)
  }
  if (searchParams?.team) {
      query = query.ilike('team_name', searchParams.team)
  }
  if (searchParams?.minPrice) {
      query = query.gte('listed_price', searchParams.minPrice)
  }
  if (searchParams?.maxPrice) {
      query = query.lte('listed_price', searchParams.maxPrice)
  }

  const { data: items, error } = await query.order('player_name', { ascending: true });`,
`  // 1. Dynamically extract the highly precise lists of available teams and years that actually exist in the DB right now
  const { rows: filterData } = await sql\`SELECT DISTINCT team_name FROM inventory WHERE status = 'available' AND team_name IS NOT NULL\`;
  const availableTeams = filterData.map(d => d.team_name).sort();

  // 2. Base Query Builder using Next.js pure SearchParams to natively enable shareable Deep Links instantly
  let items = [];
  let error = null;
  try {
     let queryStr = "SELECT * FROM inventory WHERE status = 'available'";
     const values: any[] = [];
     
     if (searchParams?.q) {
         values.push(\`%\${searchParams.q}%\`);
         queryStr += \` AND (player_name ILIKE $\${values.length} OR team_name ILIKE $\${values.length} OR card_set ILIKE $\${values.length})\`;
     }
     if (searchParams?.team) {
         values.push(searchParams.team);
         queryStr += \` AND team_name ILIKE $\${values.length}\`;
     }
     if (searchParams?.minPrice) {
         values.push(searchParams.minPrice);
         queryStr += \` AND listed_price >= $\${values.length}\`;
     }
     if (searchParams?.maxPrice) {
         values.push(searchParams.maxPrice);
         queryStr += \` AND listed_price <= $\${values.length}\`;
     }

     queryStr += " ORDER BY player_name ASC";
     const { rows } = await sql.query(queryStr, values);
     items = rows;
  } catch (err) {
     error = err;
  }
`
);

fs.writeFileSync('src/app/page.tsx', content);
