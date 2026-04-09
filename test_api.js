async function testOracleAPI() {
  const cards = [
    { player_name: "Ken Griffey Jr.", card_set: "2025 Stadium Club", card_number: "SS-24", insert_name: "Savage Sluggers", parallel_name: "" },
    { player_name: "George Brett", card_set: "2025 Stadium Club", card_number: "99" },
    { player_name: "Larry Walker", card_set: "2025 Stadium Club", card_number: "36" }
  ];

  const apiKey = "pi_live_L5-fH6I-LyizQhJIEAEZR2jDCiV3vS6o1JKc1gKtwJU"; 

  for (const c of cards) {
    const payload = {
      player_name: c.player_name,
      card_set: c.card_set,
      card_number: c.card_number,
      insert_name: c.insert_name || "Base",
      parallel_name: c.parallel_name || "Base",
      is_auto: false,
      is_relic: false,
      is_rookie: false,
      skip_fuzzy: true
    };
  
    console.log(`\n-> Testing ${c.player_name} #${c.card_number}...`);
    try {
      const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log(`<- ${response.status} Response:`);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Fetch Exception:", err.message);
    }
  }
}

testOracleAPI();
