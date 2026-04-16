"use server";

import { cookies } from "next/headers";
import { Client } from "pg";

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  if (!email || !password) return { error: "Email and password required" };

  const apiKey = process.env.PLAYERINDEX_API_KEY;
  if (!apiKey) {
    return { error: "Storefront is missing its API Key. Please redeploy with a provisioning token." };
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let siteName = 'White-Label Store';
  
  try {
    await client.connect();
    const res = await client.query("SELECT site_name FROM store_settings LIMIT 1");
    if (res.rows.length > 0 && res.rows[0].site_name) {
      siteName = res.rows[0].site_name;
    }
  } catch(e) {
    // If we can't get the site name, we'll gracefully fall back
    console.error("Failed to read site_name:", e);
  } finally {
    await client.end();
  }
  
  try {
    // Delegate to Master Player Index server
    const masterResp = await fetch('https://playerindexdata.com/api/auth/store-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        api_key: apiKey,
        store_name: siteName
      })
    });

    const data = await masterResp.json();

    if (!masterResp.ok || !data.valid) {
      return { error: data.error || "Invalid Player Index credentials or API Key ownership" };
    }
    
    // Auth succeeded globally, issue local session!
    const cookieStore = await cookies();
    cookieStore.set("admin_session", email, { httpOnly: true, path: '/' });
    
    return { success: true };
  } catch(e) {
    console.error("SSO Error:", e);
    return { error: "Failed to connect to Player Index Authentication servers" };
  }
}
