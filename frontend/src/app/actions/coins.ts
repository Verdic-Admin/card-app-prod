"use server";
import { sql } from '@vercel/postgres';

import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache'
function checkAuth() {
  if (!process.env.PLAYERINDEX_API_KEY) throw new Error("Unauthorized to access Admin operations");
}

export async function submitCoinRequest(itemId: string, email: string) {
  try {
    await sql`
      INSERT INTO coin_requests (item_id, buyer_email, status)
      VALUES (${itemId}, ${email}, 'pending')
    `;
  } catch (error: any) {
    throw new Error(`Failed to submit coin request: ${error.message}`)
  }
}

export async function fulfillCoinRequest(requestId: string, itemId: string, formData: FormData) {
  checkAuth();

  const file = formData.get('image') as File
  if (!file) throw new Error("Missing image file")

  const fileExt = file.name.split('.').pop()
  const fileName = `coin-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  let coinedImageUrl;
  try {
    const { url } = await put(`card-images/${fileName}`, file, { access: 'public' });
    coinedImageUrl = url;
  } catch (uploadError: any) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // 1. Stamp inventory
  await sql`UPDATE inventory SET coined_image_url = ${coinedImageUrl} WHERE id = ${itemId}`;

  // 2. Resolve request
  await sql`UPDATE coin_requests SET status = 'fulfilled' WHERE id = ${requestId}`;

  revalidatePath('/admin')
  revalidatePath(`/item/${itemId}`)
  return { success: true }
}

export async function getPendingCoinRequests() {
  checkAuth();
  
  const { rows } = await sql`
     SELECT c.*, row_to_json(i.*) as inventory
     FROM coin_requests c
     LEFT JOIN inventory i ON c.item_id = i.id
     WHERE c.status = 'pending'
     ORDER BY c.created_at DESC
  `;
  return rows;
}
