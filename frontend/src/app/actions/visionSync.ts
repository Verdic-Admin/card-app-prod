"use server";

export async function uploadImagesToScanner(formData: FormData) {
  const apiKey = process.env.PLAYERINDEX_API_KEY || '';
  const response = await fetch('https://api.playerindexdata.com/scan/scanner/upload', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Scanner upload failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.job_id;
}

export async function identifyCardPair(payload: { queue_id: string; side_a_url: string; side_b_url: string }) {
  const apiKey = process.env.PLAYERINDEX_API_KEY || '';
  const response = await fetch('https://api.playerindexdata.com/identify/identify/card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Identity API failed: ${response.statusText}`);
  }
  
  return await response.json();
}
