/**
 * Object Storage — Postgres bytea backend.
 * Images are stored in the `stored_images` table and served via /api/img/[id].
 * No external object storage (S3, Tigris, etc.) is required.
 */
import pool from '@/utils/db';
import { getAppOrigin } from '@/utils/app-origin';

export interface StoragePutOptions {
  contentType?: string;
  /** Kept for call-site compatibility — Postgres storage is always public via /api/img/. */
  access?: 'public';
}

/**
 * Store a file in Postgres and return its public URL (/api/img/<id>).
 */
export async function put(
  _path: string,
  file: File | Blob | Buffer,
  options?: StoragePutOptions,
): Promise<{ url: string }> {
  const contentType =
    options?.contentType ??
    (file instanceof File ? file.type : 'application/octet-stream');

  let buf: Buffer;
  if (Buffer.isBuffer(file)) {
    buf = file;
  } else {
    buf = Buffer.from(await (file as Blob).arrayBuffer());
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO stored_images (data, content_type) VALUES ($1, $2) RETURNING id`,
    [buf, contentType],
  );

  const id = rows[0].id;
  const origin = getAppOrigin() || '';
  return { url: `${origin}/api/img/${id}` };
}

/**
 * Delete one or more stored images by their /api/img/<id> URLs.
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const ids: string[] = [];
  for (const url of urls) {
    const match = url.match(/\/api\/img\/([0-9a-f-]{36})/i);
    if (match) ids.push(match[1]);
  }
  if (ids.length) {
    await pool.query(`DELETE FROM stored_images WHERE id = ANY($1::uuid[])`, [ids]);
  }
}
