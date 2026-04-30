/**
 * Quick test: Hit Oracle /v1/calculate with Luke Keaschall 1/1 and print_run=1
 * Run: node test_grail.js
 */
const fs = require('fs');
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const API_KEY = process.env.PLAYERINDEX_API_KEY;
const BASE = process.env.API_BASE_URL || 'https://api.playerindexdata.com';

if (!API_KEY) {
  console.error('Missing PLAYERINDEX_API_KEY in .env.local');
  process.exit(1);
}

async function main() {
  const payload = {
    player_name: "Luke Keaschall",
    card_set: "2025 Topps Update Series",
    card_number: "US16",
    insert_name: "Base",
    parallel_name: "Base",
    print_run: 1,
    is_rookie: true,
    is_auto: false,
    is_relic: false,
    skip_fuzzy: false,
  };

  console.log(`\n→ POST ${BASE}/v1/calculate`);
  console.log('→ Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${BASE}/v1/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(payload),
  });

  console.log(`\n← HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  console.log('\n── Oracle Response ──');
  console.log(JSON.stringify(data, null, 2));

  // Highlight key fields
  if (data.target_price) {
    console.log(`\n🎯 Target Price:  $${data.target_price}`);
    console.log(`📊 Arb Signal:    ${data.arbitrage_signal}`);
    if (data.signals?.t_1_of_1) {
      console.log(`🏆 Grail T(1/1):  $${data.signals.t_1_of_1}`);
      console.log(`📈 r_grail:       ${data.signals.r_grail}`);
      console.log(`💰 i_macro:       ${data.signals.i_macro}`);
    }
    if (data.signals?.grail_waterfall) {
      console.log(`🔥 Grail Source:  ${data.signals.grail_waterfall.source || 'N/A'}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
