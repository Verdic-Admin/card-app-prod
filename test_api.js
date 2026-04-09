async function testOracleAPI() {
  const payload = {
    player_name: "Miguel Cabrera",
    card_set: "2025 Stadium Club",
    card_number: "55",
    insert_name: "Base",
    parallel_name: "Base",
    is_auto: false,
    is_relic: false,
    is_rookie: false,
    skip_fuzzy: true
  };

  console.log("-> Sending Payload to /calculate:", payload);
  const apiKey = "pi_live_L5-fH6I-LyizQhJIEAEZR2jDCiV3vS6o1JKc1gKtwJU"; 
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
    console.log(`\n<- ${response.status} Response:`);
    console.log(data);
  } catch (err) {
    console.error("Fetch Exception:", err.message);
  }
}
testOracleAPI();
