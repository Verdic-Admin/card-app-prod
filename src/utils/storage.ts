import { put as blobPut, del as blobDel } from '@vercel/blob';

export interface StoragePutOptions {
  contentType?: string;
  /** Accepted for backward compatibility — Vercel Blob is always public. */
  access?: 'public';
}

/**
 * Upload a file to Vercel Blob (public CDN).
 * Returns the direct public URL — no proxy route needed.
 */
export async function put(
  path: string,
  file: File | Blob | Buffer,
  options?: StoragePutOptions
): Promise<{ url: string }> {
  const contentType =
    options?.contentType ??
    (file instanceof File ? file.type : 'application/octet-stream');

  const blob = await blobPut(path, file, {
    access: 'public',
    contentType,
  });

  return { url: blob.url };
}

/**
 * Delete one or more files from Vercel Blob by their CDN URL(s).
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  await blobDel(urls);
}
