/**
 * Object Storage — S3-compatible (t3.storageapi.dev / Railway Tigris / AWS S3).
 * Uses virtual-hosted-style URLs: https://<bucket>.<endpoint>/<key>
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

const S3_ENDPOINT = (process.env.S3_ENDPOINT || '').replace(/\/$/, '').trim();
const S3_BUCKET   = (process.env.S3_BUCKET_NAME || '').trim();
const S3_REGION   = (process.env.AWS_REGION || 'auto').trim();

let s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: S3_ENDPOINT || undefined,
      region: S3_REGION,
      credentials: {
        accessKeyId:     process.env.S3_ACCESS_KEY_ID     || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: false, // virtual-hosted-style: https://<bucket>.<endpoint>/<key>
    });
  }
  return s3;
}

/** Public URL for a stored object — virtual-hosted style. */
function publicUrl(key: string): string {
  // Strip https:// prefix, prepend bucket as subdomain
  const host = S3_ENDPOINT.replace(/^https?:\/\//, '');
  return `https://${S3_BUCKET}.${host}/${key}`;
}

export interface StoragePutOptions {
  contentType?: string;
  /** Kept for call-site compatibility — all uploads are public-read. */
  access?: 'public';
}

/**
 * Upload a file to S3-compatible object storage.
 * Returns the direct public URL.
 */
export async function put(
  path: string,
  file: File | Blob | Buffer,
  options?: StoragePutOptions,
): Promise<{ url: string }> {
  if (!S3_ENDPOINT || !S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      'Object storage is not configured. Set S3_ENDPOINT, S3_BUCKET_NAME, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY in your Railway service Variables, then redeploy.',
    );
  }

  const contentType =
    options?.contentType ??
    (file instanceof File ? file.type : 'application/octet-stream');

  let body: Buffer;
  if (Buffer.isBuffer(file)) {
    body = file;
  } else {
    body = Buffer.from(await (file as Blob).arrayBuffer());
  }

  const params: PutObjectCommandInput = {
    Bucket: S3_BUCKET,
    Key: path,
    Body: body,
    ContentType: contentType,
    // Note: ACL is intentionally omitted — Railway Tigris and most S3-compatible
    // providers manage bucket-level access policies, not per-object ACLs.
  };

  await getS3Client().send(new PutObjectCommand(params));
  return { url: publicUrl(path) };
}

/**
 * Delete one or more files from S3 by their public URLs.
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const client = getS3Client();
  for (const url of urls) {
    try {
      // Extract the key: everything after the bucket subdomain + host
      const u = new URL(url);
      const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      if (key) await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (e) {
      console.warn('[storage] Failed to delete object:', url, e);
    }
  }
}
