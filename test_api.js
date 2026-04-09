async function test() {
  const payload = {
    player_name: "Gunnar Henderson",
    card_number: "US250",
    card_set: "2023 Topps Update",
    attributes: "2023 Topps Update US250",
    storefront_id: "single-eval"
  };

  const apiKey = "pi_live_L5-fH6I-LyizQhJIEAEZR2jDCiV3vS6o1JKc1gKtwJU";
  const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/b2b/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log(response.status, data);
}

test();
